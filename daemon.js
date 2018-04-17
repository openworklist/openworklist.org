
var etherscanApiKey = process.argv[2]
var etherscan_delay = 1000 // one second between etherscan calls

const Firestore = require('@google-cloud/firestore')
const firestore = new Firestore({
	projectId: 'openworklist',
	keyFilename: '../firekeys.json',
})

require('./OWL_MSG_V106.js')
var OWL_MSG = OWL_MSG_V106

do_it('ropsten')
do_it('mainnet')

function do_it(net) {
	firestore.doc(OWL_MSG.v + '_' + net + '_globals/globals').get().then(function (g) {
		var g_ref = g.ref
		g = g.data()
		var next_block = g.next_block
		function loop() {
			console.log(net + ' : getting block : ' + next_block)
			wget({
				host: g.host,
				path: '/api?module=logs&action=getLogs&fromBlock=' + next_block +
					'&toBlock=latest&topic0=0x0000000000000000000000000000000000000000' + OWL_MSG.v_hex +
					'&apikey=' + etherscanApiKey
			}, function (x) {
				if (x == null) {
					console.log('wget encountered an error')
					setTimeout(loop, etherscan_delay)
					return
				}
				try {
					x = JSON.parse(x)
				} catch (e) {
					console.log('e: ' + e + ', x: ' + x)
					setTimeout(loop, etherscan_delay)
					return
				}
				if (x.status == '0' && x.message == 'No records found') {
					setTimeout(loop, etherscan_delay)
				} else if (x.status == '1' && x.message == 'OK') {
					var max_block_number = next_block
					var i = 0
					function loop2() {
						if (i < x.result.length) {
							var r = x.result[i]
							i++
							console.log(net + ' : getting trans : ' + r.transactionHash)
							wget({
								host: g.host,
								path: '/api?module=proxy&' +
									'action=eth_getTransactionByHash&txhash=' +
									r.transactionHash +
									'&apikey=' + etherscanApiKey
							}, function (x) {
								if (x == null) {
									console.log('wget encountered an error')
									setTimeout(loop, etherscan_delay)
									return
								}
								x = JSON.parse(x)
								if (x.result) {
									var block_number = parseInt(x.result.blockNumber.substr(2), 16)
									if (block_number > max_block_number) {
										max_block_number = block_number
									}

									console.log('got result: ', x.result.input)

									try {
										var input = x.result.input.substr(2)
										var decode = OWL_MSG.decode(input)
									} catch (e) {
										console.log('e: ' + e)
										setTimeout(loop2, etherscan_delay)
										return
									}
									firestore.collection(g.trans_collection).doc(
										r.transactionHash.substr(2)).set({
										    input : input,
										    decode : decode,
										    parent : decode.parent,
										    from : x.result.from
									}).then(function() {
										setTimeout(loop2, etherscan_delay)
									})
								}
							})
						} else {
							next_block = max_block_number + 1
							g_ref.update({
								next_block : next_block
							}).then(function () {
								setTimeout(loop, etherscan_delay)
							})
						}
					}
					setTimeout(loop2, etherscan_delay)
				}
			})
		}
		setTimeout(loop, etherscan_delay)
	})
}

function wget(options, cb) {
	var https = require('https')
	https.get(options, function (res) {
		res.setEncoding('utf8')
		var data = []
		res.on('data', (chunk) => {
			data.push(chunk)
		})
		res.on('end', () => {
			cb(data.join(''))
		})
	}).on('error', function(e) {
		cb(null)
	})
}
