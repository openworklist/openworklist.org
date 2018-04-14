
OWL_MSG_V106 = (function () {
    var self = {}
    self.v = 'OWL_MSG_V106'
    self.v_hex = str_to_hex(self.v)
    self.encode = encode
    self.decode = decode
    return self;

    function encode(o) {
        var c = []
        
        function push(hex) {
            if (hex.startsWith('0x')) hex = hex.substr(2)
            if (hex.length % 2 == 1) hex = '0' + hex
            return num_to_hex(95 + hex.length/2) + hex
        }
        
        c.push('6000') // PUSH1 00
        c.push(push(self.v_hex))
        c.push('8180a1') // DUP2 DUP1 LOG1

        c.push('601a565b600080fd5b') // PUSH1 1a JUMP JUMPDEST PUSH1 00 DUP1 REVERT JUMPDEST
        c.push('6015') // PUSH1 15 (crash address)

        if (o.pays && (o.pays.length > 0)) {
            c.push('6108fc') // PUSH2 08fc (for gas)
            c.push('6001') // PUSH1 01
            for (var i = 0; i < o.pays.length; i++) {
                c.push('83808080') // DUP4 (0) DUP1 DUP1 DUP1
                c.push(push(o.pays[i].wei))
                c.push(push(o.pays[i].to))
                c.push('87f1') // DUP8 (the gas) CALL
                
                c.push('8114158357') // DUP2 (1) EQ ISZERO DUP4 (crash address) JUMPI
            }
            c.push('5050') // POP POP
        }

        c.push('30318157') // ADDRESS BALANCE DUP2 JUMPI

        c.push('63600080fd') // PUSH4 600080fd
        c.push('82526004601cf3') // DUP3 MSTORE PUSH1 04 PUSH1 1c RET

        c.push(push(o.parent))
        c.push(str_to_hex(o.text))
        
        return c.join('')
    }

    function decode(hex) {
        var o = {}
        
        var hex_i = 0
        function unpush() {
            var h = hex.substr(hex_i, 2)
            var i = parseInt(h, 16)
            if (i < 0) throw 'bad'
            var len = i - 95
            if (len > 32) throw 'bad'
            var ret = hex.substr(hex_i + 2, len*2)
            hex_i += 2 + len*2
            return ret
        }
        function check(b) {
            if (!b) {
                throw 'bad'
            }
        }
        function check_next(s) {
            check(s == hex.substr(hex_i, s.length))
            hex_i += s.length
        }
        function peek() {
            return hex.substr(hex_i, 2)
        }

        check_next('6000') // PUSH1 00
        check(hex_to_str(unpush()) == self.v)
        check_next('8180a1') // DUP2 DUP1 LOG1


        check_next('601a565b600080fd5b') // PUSH1 1a JUMP JUMPDEST PUSH1 00 DUP1 REVERT JUMPDEST
        check_next('6015') // PUSH1 15 (crash address)
        
        if (peek() == '61') {
            check_next('6108fc') // PUSH2 08fc (for gas)
            check_next('6001') // PUSH1 01
            o.pays = []
            while (peek() == '83') {
                check_next('83808080') // DUP4 (0) DUP1 DUP1 DUP1
                o.pays.push({
                    wei : '0x' + unpush(),
                    to : '0x' + unpush()
                })
                check_next('87f1') // DUP8 (the gas) CALL
                
                check_next('8114158357') // DUP2 (1) EQ ISZERO DUP4 (crash address) JUMPI
            }
            check_next('5050') // POP POP
        }
        
        check_next('30318157') // ADDRESS BALANCE DUP2 JUMPI

        check_next('63600080fd') // PUSH4 600080fd
        check_next('82526004601cf3') // DUP3 MSTORE PUSH1 04 PUSH1 1c RET

        o.parent = '0x' + unpush()
        o.text = hex_to_str(hex.substr(hex_i))

        return o
    }

    function num_to_hex(n) {
        var h = n.toString(16)
        if (h.length % 2 == 1) return '0' + h
        return h
    }

    function str_to_hex(s) {
        var h = []
        for (var i = 0; i < s.length; i++) {
            h.push(num_to_hex(s.charCodeAt(i)))
        }
        return h.join('')
    }

    function hex_to_str(h) {
        if (h.length % 2 == 1) return '0' + h
        var s = []
        for (var i = 0; i < h.length; i += 2) {
            s.push(String.fromCharCode(parseInt(h.substr(i, 2), 16)))
        }
        return s.join('')
    }

})();
