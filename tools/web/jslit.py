"""Lee literales de objeto JavaScript (claves sin comillas, números, cadenas, arreglos) como datos, sin ejecutar nada.

uso: python3 -I jslit.py <app.min.js> <salida.json>
Busca en el código los catálogos (sprites, arenas, huevos) y los guarda como JSON.
"""
import json, re, sys


class P:
    def __init__(self, s, i):
        self.s, self.i = s, i

    def ws(self):
        while self.i < len(self.s) and self.s[self.i] in ' \t\r\n':
            self.i += 1

    def value(self):
        self.ws()
        c = self.s[self.i]
        if c == '{':
            return self.obj()
        if c == '[':
            return self.arr()
        if c in '"\'':
            return self.string()
        if c == '!':
            m = re.compile(r'!(0x0|0x1|0|1)').match(self.s, self.i)
            self.i = m.end()
            return m.group(1) in ('0x0', '0')
        m = re.compile(r'-?(0x[0-9a-fA-F]+|\d*\.\d+(e[-+]?\d+)?|\d+(e[-+]?\d+)?)').match(self.s, self.i)
        if m:
            self.i = m.end()
            t = m.group(0)
            neg = t.startswith('-')
            t = t.lstrip('-')
            v = int(t, 16) if t.startswith('0x') else (float(t) if ('.' in t or 'e' in t) else int(t))
            return -v if neg else v
        for lit, val in (('true', True), ('false', False), ('null', None)):
            if self.s.startswith(lit, self.i):
                self.i += len(lit)
                return val
        # Expresión no literal (p. ej. hu(0x971), una cadena ofuscada): se deja como None sin evaluarla
        m = re.compile(r'[A-Za-z_$][\w$]*').match(self.s, self.i)
        if m:
            self.i = m.end()
            while self.i < len(self.s) and self.s[self.i] in '([':
                close = ')' if self.s[self.i] == '(' else ']'
                d = 0
                while True:
                    c = self.s[self.i]
                    if c in '([':
                        d += 1
                    elif c in ')]':
                        d -= 1
                        if d == 0:
                            self.i += 1
                            break
                    self.i += 1
            return None
        raise ValueError('valor no literal en %d: %r' % (self.i, self.s[self.i:self.i + 40]))

    def string(self):
        q = self.s[self.i]
        self.i += 1
        out = []
        while self.s[self.i] != q:
            c = self.s[self.i]
            if c == '\\':
                n = self.s[self.i + 1]
                if n == 'x':
                    out.append(chr(int(self.s[self.i + 2:self.i + 4], 16))); self.i += 4; continue
                if n == 'u':
                    out.append(chr(int(self.s[self.i + 2:self.i + 6], 16))); self.i += 6; continue
                out.append({'n': '\n', 't': '\t'}.get(n, n)); self.i += 2; continue
            out.append(c)
            self.i += 1
        self.i += 1
        return ''.join(out)

    def key(self):
        self.ws()
        c = self.s[self.i]
        if c in '"\'':
            return self.string()
        m = re.compile(r'[A-Za-z0-9_$.\-]+').match(self.s, self.i)
        self.i = m.end()
        k = m.group(0)
        if k.startswith('0x'):
            k = str(int(k, 16))
        elif re.fullmatch(r'\d+(\.\d+)?e\d+', k):
            k = str(int(float(k)))
        return k

    def obj(self):
        self.i += 1
        o = {}
        while True:
            self.ws()
            if self.s[self.i] == '}':
                self.i += 1
                return o
            k = self.key()
            self.ws()
            assert self.s[self.i] == ':', self.s[self.i:self.i + 30]
            self.i += 1
            o[k] = self.value()
            self.ws()
            if self.s[self.i] == ',':
                self.i += 1

    def arr(self):
        self.i += 1
        a = []
        while True:
            self.ws()
            if self.s[self.i] == ']':
                self.i += 1
                return a
            a.append(self.value())
            self.ws()
            if self.s[self.i] == ',':
                self.i += 1


def enclosing(s, i):
    d = 0
    for j in range(i, -1, -1):
        if s[j] == '}':
            d += 1
        elif s[j] == '{':
            if d == 0:
                return j
            d -= 1
    return -1


def grab(s, pattern, outer=True):
    m = re.search(pattern, s)
    if not m:
        return None
    start = enclosing(s, m.start()) if outer else m.start()
    return P(s, start).value()


if __name__ == '__main__':
    src = open(sys.argv[1], encoding='utf-8').read()
    out = {
        'sprites': grab(src, r'[{,]1:\{s:1,a:\{Idle:'),
    }
    print({k: (len(v) if v else None) for k, v in out.items()})
    json.dump(out, open(sys.argv[2], 'w'), separators=(',', ':'))
