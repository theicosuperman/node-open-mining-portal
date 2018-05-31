var zlib = require('zlib');

var redis = require('redis');
var async = require('async');


var os = require('os');

var algos = require('stratum-pool/lib/algoProperties.js');

const logger = require('./logger.js').getLogger('Stats', 'system');

function rediscreateClient(port, host, pass) {
    var client = redis.createClient(port, host);
    if (pass) {
        client.auth(pass);
    }
    return client;
}
/* ADDENDUM FROM z-NOMP */
 function readableSeconds(t) {
        var seconds = Math.round(t);
        var minutes = Math.floor(seconds/60);
        var hours = Math.floor(minutes/60);
        var days = Math.floor(hours/24);
        hours = hours-(days*24);
        minutes = minutes-(days*24*60)-(hours*60);
        seconds = seconds-(days*24*60*60)-(hours*60*60)-(minutes*60);
        if (days > 0) { return (days + "d " + hours + "h " + minutes + "m " + seconds + "s"); }
        if (hours > 0) { return (hours + "h " + minutes + "m " + seconds + "s"); }
        if (minutes > 0) {return (minutes + "m " + seconds + "s"); }
        return (seconds + "s");
    }
function sortPoolsByName(objects) {
		var newObject = {};
		var sortedArray = sortProperties(objects, 'name', false, false);
		for (var i = 0; i < sortedArray.length; i++) {
			var key = sortedArray[i][0];
			var value = sortedArray[i][1];
			newObject[key] = value;
		}
		return newObject;
    }
    
    function sortBlocks(a, b) {
        var as = parseInt(a.split(":")[2]);
        var bs = parseInt(b.split(":")[2]);
        if (as > bs) return -1;
        if (as < bs) return 1;
        return 0;
    }
	
	function sortWorkersByName(objects) {
		var newObject = {};
		var sortedArray = sortProperties(objects, 'name', false, false);
		for (var i = 0; i < sortedArray.length; i++) {
			var key = sortedArray[i][0];
			var value = sortedArray[i][1];
			newObject[key] = value;
		}
		return newObject;
	}
	/*
	function sortMinersByHashrate(objects) {
		var newObject = {};
		var sortedArray = sortProperties(objects, 'shares', true, true);
		for (var i = 0; i < sortedArray.length; i++) {
			var key = sortedArray[i][0];
			var value = sortedArray[i][1];
			newObject[key] = value;
		}
		return newObject;
	}
	
	function sortWorkersByHashrate(a, b) {
		if (a.hashrate === b.hashrate) {
			return 0;
		}
		else {
			return (a.hashrate < b.hashrate) ? -1 : 1;
		}
	}
	
    this.getReadableHashRateString = function(hashrate){
		hashrate = (hashrate * 2);
		if (hashrate < 1000000) {
			return (Math.round(hashrate / 1000) / 1000 ).toFixed(2)+' Sol/s';
		}
        var byteUnits = [ ' Sol/s', ' KSol/s', ' MSol/s', ' GSol/s', ' TSol/s', ' PSol/s' ];
        var i = Math.floor((Math.log(hashrate/1000) / Math.log(1000)) - 1);
        hashrate = (hashrate/1000) / Math.pow(1000, i + 1);
        return hashrate.toFixed(2) + byteUnits[i];
    };
	
	function getReadableNetworkHashRateString(hashrate) {
		hashrate = (hashrate * 1000000);
		if (hashrate < 1000000)
			return '0 Sol';
		var byteUnits = [ ' Sol/s', ' KSol/s', ' MSol/s', ' GSol/s', ' TSol/s', ' PSol/s' ];
		var i = Math.floor((Math.log(hashrate/1000) / Math.log(1000)) - 1);
		hashrate = (hashrate/1000) / Math.pow(1000, i + 1);
		return hashrate.toFixed(2) + byteUnits[i];
	}
*/
/*
 * Sort object properties (only own properties will be sorted).
 * @param {object} obj object to sort properties
 * @param {string|int} sortedBy 1 - sort object properties by specific value.
 * @param {bool} isNumericSort true - sort object properties as numeric value, false - sort as string value.
 * @param {bool} reverse false - reverse sorting.
 * @returns {Array} array of items in [[key,value],[key,value],...] format.
 */
function sortProperties(obj, sortedBy, isNumericSort, reverse) {
	sortedBy = sortedBy || 1; // by default first key
	isNumericSort = isNumericSort || false; // by default text sort
	reverse = reverse || false; // by default no reverse

	var reversed = (reverse) ? -1 : 1;

	var sortable = [];
	for (var key in obj) {
		if (obj.hasOwnProperty(key)) {
			sortable.push([key, obj[key]]);
		}
	}
	if (isNumericSort)
		sortable.sort(function (a, b) {
			return reversed * (a[1][sortedBy] - b[1][sortedBy]);
		});
	else
		sortable.sort(function (a, b) {
			var x = a[1][sortedBy].toLowerCase(),
				y = b[1][sortedBy].toLowerCase();
			return x < y ? reversed * -1 : x > y ? reversed : 0;
		});
	return sortable; // array in format [ [ key1, val1 ], [ key2, val2 ], ... ]
}

module.exports = function (portalConfig, poolConfigs) {
    logger.info("Starting stats module");
    var _this = this;
    var redisClients = [];
    var redisStats;
    this.statHistory = [];
    this.statPoolHistory = [];
    this.stats = {};
    this.statsString = '';


    logger.debug("Setting up statsRedis");
    setupStatsRedis();

    logger.debug("Setting up statHistory");
    gatherStatHistory();

		
    Object.keys(poolConfigs).forEach(function (coin) {
//* if (!canDoStats) return; Z-NOMP have this */

        var poolConfig = poolConfigs[coin];
        var redisConfig = poolConfig.redis;

        for (var i = 0; i < redisClients.length; i++) {
            var client = redisClients[i];
            if (client.client.port === redisConfig.port && client.client.host === redisConfig.host) {
                client.coins.push(coin);
                return;
            }
        }
        redisClients.push({
            coins: [coin],
            client: redis.createClient(redisConfig.port, redisConfig.host)
        });
    });


    function setupStatsRedis() {
        redisStats = redis.createClient(portalConfig.redis.port, portalConfig.redis.host);
        redisStats.on('error', function (err) {
            logger.error('Redis for stats had an error = %s', JSON.stringify(err));

        });
    }
/*ADDENDUM from Z-NOMP */		
   this.getBlocks = function (cback) {
        var allBlocks = {};
        async.each(_this.stats.pools, function(pool, pcb) {

            if (_this.stats.pools[pool.name].pending && _this.stats.pools[pool.name].pending.blocks)
                for (var i=0; i<_this.stats.pools[pool.name].pending.blocks.length; i++)
                    allBlocks[pool.name+"-"+_this.stats.pools[pool.name].pending.blocks[i].split(':')[2]] = _this.stats.pools[pool.name].pending.blocks[i];
        
            if (_this.stats.pools[pool.name].confirmed && _this.stats.pools[pool.name].confirmed.blocks)
                for (var i=0; i<_this.stats.pools[pool.name].confirmed.blocks.length; i++)
                    allBlocks[pool.name+"-"+_this.stats.pools[pool.name].confirmed.blocks[i].split(':')[2]] = _this.stats.pools[pool.name].confirmed.blocks[i];
            console.log(JSON.stringify(allBlocks));
            pcb();
        }, function(err) {
            cback(allBlocks);            
        });
				
				
    };
/* END ADDENDUM */
	
	/* Equal */	
    function gatherStatHistory() {
        var retentionTime = (((Date.now() / 1000) - portalConfig.website.stats.historicalRetention) | 0).toString();
        redisStats.zrangebyscore(['statHistory', retentionTime, '+inf'], function (err, replies) {
            if (err) {
                logger.error('Error when trying to grab historical stats, err = %s', JSON.stringify(err));
                return;
            }
            for (var i = 0; i < replies.length; i++) {
                _this.statHistory.push(JSON.parse(replies[i]));
            }
            _this.statHistory = _this.statHistory.sort(function (a, b) {
                return a.time - b.time;
            });
            _this.statHistory.forEach(function (stats) {
                addStatPoolHistory(stats);
            });
        });
    }
/* Equal */
    function addStatPoolHistory(stats) {
        var data = {
            time: stats.time,
            pools: {}
        };
        for (var pool in stats.pools) {
            data.pools[pool] = {
                hashrate: stats.pools[pool].hashrate,
                workerCount: stats.pools[pool].workerCount,
                blocks: stats.pools[pool].blocks
            }
        }
        _this.statPoolHistory.push(data);
    }
    this.getGlobalStats = function (callback) {

     var statGatherTime = Date.now() / 1000 | 0;

        var allCoinStats = {};

        async.each(redisClients, function (client, callback) {
            var windowTime = (((Date.now() / 1000) - portalConfig.website.stats.hashrateWindow) | 0).toString();
            var redisCommands = [];


            var redisCommandTemplates = [
                ['zremrangebyscore', ':hashrate', '-inf', '(' + windowTime],
                ['zrangebyscore', ':hashrate', windowTime, '+inf'],
                ['hgetall', ':stats'],
                ['scard', ':blocksPending'],
                ['scard', ':blocksConfirmed'],
                ['scard', ':blocksOrphaned'],
								['smembers', ':blocksPending'],
							  ['smembers', ':blocksConfirmed'],
				        ['hgetall', ':shares:roundCurrent'],
                ['hgetall', ':blocksPendingConfirms'],
                ['zrange', ':payments', -100, -1],
                ['hgetall', ':shares:timesCurrent']

            ];

            var commandsPerCoin = redisCommandTemplates.length;

            client.coins.map(function (coin) {
                redisCommandTemplates.map(function (t) {
                    var clonedTemplates = t.slice(0);
                    clonedTemplates[1] = coin + clonedTemplates[1];
                    redisCommands.push(clonedTemplates);
                });
            });


            client.client.multi(redisCommands).exec(function (err, replies) {
                if (err) {

                    logger.error('Error with getting global stats, err = %s', JSON.stringify(err));
                    callback(err);
                }
                else {

                    for (var i = 0; i < replies.length; i += commandsPerCoin) {
                        var coinName = client.coins[i / commandsPerCoin | 0];
												//do we need it at all?
												var marketStats = {};
                        if (replies[i + 2]) {
                            if (replies[i + 2].coinmarketcap) {
                                marketStats = replies[i + 2] ? (JSON.parse(replies[i + 2].coinmarketcap)[0] || 0) : 0;
                            }
                        }
                        var coinStats = {
                            name: coinName,
                            symbol: poolConfigs[coinName].coin.symbol.toUpperCase(),
                            algorithm: poolConfigs[coinName].coin.algorithm,
                            hashrates: replies[i + 1],
                            poolStats: {
														validShares: replies[i + 2] ? (replies[i + 2].validShares || 0) : 0,
                            validBlocks: replies[i + 2] ? (replies[i + 2].validBlocks || 0) : 0,
                            invalidShares: replies[i + 2] ? (replies[i + 2].invalidShares || 0) : 0,
                            totalPaid: replies[i + 2] ? (replies[i + 2].totalPaid || 0) : 0,
														networkBlocks: replies[i + 2] ? (replies[i + 2].networkBlocks || 0) : 0
														//networkSols: replies[i + 2] ? (replies[i + 2].networkSols || 0) : 0, 
														//networkSolsString: getReadableNetworkHashRateString(replies[i + 2] ? (replies[i + 2].networkSols || 0) : 0), 
														//networkDiff: replies[i + 2] ? (replies[i + 2].networkDiff || 0) : 0,
													//	networkConnections: replies[i + 2] ? (replies[i + 2].networkConnections || 0) : 0,
                           // networkVersion: replies[i + 2] ? (replies[i + 2].networkSubVersion || 0) : 0,
                          //  networkProtocolVersion: replies[i + 2] ? (replies[i + 2].networkProtocolVersion || 0) : 0
                            },
														marketStats: marketStats,
                            /* block stat counts */
                            blocks: {
                                pending: replies[i + 3],
                                confirmed: replies[i + 4],
                                orphaned: replies[i + 5]
                            },
                            /* show all pending blocks */
														pending: {
														blocks: replies[i + 6].sort(sortBlocks),
                            confirms: (replies[i + 9] || {})
														},
                            /* show last 50 found blocks */
													confirmed: {
													blocks: replies[i + 7].sort(sortBlocks).slice(0,50)
													},
                            payments: [],
													currentRoundShares: (replies[i + 8] || {}),
                            currentRoundTimes: (replies[i + 11] || {}),
                            maxRoundTime: 0,
                            shareCount: 0
												};
												for(var j = replies[i + 10].length; j > 0; j--){
                            var jsonObj;
                            try {
                                jsonObj = JSON.parse(replies[i + 10][j-1]);
                            } catch(e) {
                                jsonObj = null;
                            }
                            if (jsonObj !== null) { 
                                coinStats.payments.push(jsonObj);
                            }
                        }
                        allCoinStats[coinStats.name] = (coinStats);
                    }


                    callback();
                }
            });
        }, function (err) {
            if (err) {

                logger.error('Error getting all stats, err = %s', JSON.stringify(err));
                callback();
                return;
            }

            var portalStats = {
                time: statGatherTime,
                global: {

                    workers: 0,
                    hashrate: 0
                },
                algos: {},
                pools: allCoinStats
            };

            Object.keys(allCoinStats).forEach(function (coin) {
                var coinStats = allCoinStats[coin];
                coinStats.workers = {};

                coinStats.shares = 0;
                coinStats.hashrates.forEach(function (ins) {
                    var parts = ins.split(':');
                    var workerShares = parseFloat(parts[0]);

                    var worker = parts[1];

                    if (workerShares > 0) {
                        coinStats.shares += workerShares;

                        if (worker in coinStats.workers)
                            coinStats.workers[worker].shares += workerShares;
                        else


                            coinStats.workers[worker] = {


                                shares: workerShares,
                                invalidshares: 0,
                                hashrateString: null

                            };

                    }
                    else {

                        if (worker in coinStats.workers)
                            coinStats.workers[worker].invalidshares -= workerShares; // workerShares is negative number!
                        else

                            coinStats.workers[worker] = {

                                shares: 0,
                                invalidshares: -workerShares,
                                hashrateString: null
                            };

                    }
                });

                var shareMultiplier = Math.pow(2, 32) / algos[coinStats.algorithm].multiplier;
                coinStats.hashrate = shareMultiplier * coinStats.shares / portalConfig.website.stats.hashrateWindow;

                coinStats.workerCount = Object.keys(coinStats.workers).length;
                portalStats.global.workers += coinStats.workerCount;

                /* algorithm specific global stats */
                var algo = coinStats.algorithm;
                if (!portalStats.algos.hasOwnProperty(algo)) {
                    portalStats.algos[algo] = {
                        workers: 0,
                        hashrate: 0,
                        hashrateString: null
                    };
                }
                portalStats.algos[algo].hashrate += coinStats.hashrate;
                portalStats.algos[algo].workers += Object.keys(coinStats.workers).length;
								
								//ADDENDUM
								var _shareTotal = parseFloat(0);
                var _maxTimeShare = parseFloat(0);
								
								for (var worker in coinStats.currentRoundShares) {
                  /*  var miner = worker.split(".")[0];
                    if (miner in coinStats.miners) {
                        coinStats.miners[miner].currRoundShares += parseFloat(coinStats.currentRoundShares[worker]);
                    }*/
                    if (worker in coinStats.workers) {
                        coinStats.workers[worker].currRoundShares += parseFloat(coinStats.currentRoundShares[worker]);
                    }
                    _shareTotal += parseFloat(coinStats.currentRoundShares[worker]);
                }
                for (var worker in coinStats.currentRoundTimes) {
                    var time = parseFloat(coinStats.currentRoundTimes[worker]);
                    if (_maxTimeShare < time) { _maxTimeShare = time; }
                    var miner = worker.split(".")[0];	// split poolId from minerAddress
                    if (miner in coinStats.miners && coinStats.miners[miner].currRoundTime < time) {
                        coinStats.miners[miner].currRoundTime = time;
                    }
                }

                coinStats.shareCount = _shareTotal;
                coinStats.maxRoundTime = _maxTimeShare;
                coinStats.maxRoundTimeString = readableSeconds(_maxTimeShare);
								
                for (var worker in coinStats.workers) {
                 var _workerRate = shareMultiplier * coinStats.workers[worker].shares / portalConfig.website.stats.hashrateWindow;
									var _wHashRate = (_workerRate / 1000000) * 2;
									coinStats.workers[worker].luckDays = ((_networkHashRate / _wHashRate * _blocktime) / (24 * 60 * 60)).toFixed(3);
									coinStats.workers[worker].luckHours = ((_networkHashRate / _wHashRate * _blocktime) / (60 * 60)).toFixed(3);
									coinStats.workers[worker].hashrate = _workerRate;
									coinStats.workers[worker].hashrateString = _this.getReadableHashRateString(_workerRate);
									var miner = worker.split('.')[0];
										if (miner in coinStats.miners) {
										coinStats.workers[worker].currRoundTime = coinStats.miners[miner].currRoundTime;
										}
                }

					for (var miner in coinStats.miners) {
					var _workerRate = shareMultiplier * coinStats.miners[miner].shares / portalConfig.website.stats.hashrateWindow;
					var _wHashRate = (_workerRate / 1000000) * 2;
					coinStats.miners[miner].luckDays = ((_networkHashRate / _wHashRate * _blocktime) / (24 * 60 * 60)).toFixed(3);
					coinStats.miners[miner].luckHours = ((_networkHashRate / _wHashRate * _blocktime) / (60 * 60)).toFixed(3);
					coinStats.miners[miner].hashrate = _workerRate;
					coinStats.miners[miner].hashrateString = _this.getReadableHashRateString(_workerRate);
                }
				
				// sort workers by name
					coinStats.workers = sortWorkersByName(coinStats.workers);

          delete coinStats.hashrates;
          delete coinStats.shares;
          coinStats.hashrateString = _this.getReadableHashRateString(coinStats.hashrate);
          });

						//////////////
            Object.keys(portalStats.algos).forEach(function (algo) {
                var algoStats = portalStats.algos[algo];
                algoStats.hashrateString = _this.getReadableHashRateString(algoStats.hashrate);
            });

            _this.stats = portalStats;


            _this.statsString = JSON.stringify(portalStats);
            _this.statHistory.push(portalStats);

            addStatPoolHistory(portalStats);


            var retentionTime = (((Date.now() / 1000) - portalConfig.website.stats.historicalRetention) | 0);

            for (var i = 0; i < _this.statHistory.length; i++) {
                if (retentionTime < _this.statHistory[i].time) {
                    if (i > 0) {
                        _this.statHistory = _this.statHistory.slice(i);
                        _this.statPoolHistory = _this.statPoolHistory.slice(i);
                    }
                    break;
                }
            }

            redisStats.multi([
                ['zadd', 'statHistory', statGatherTime, _this.statsString],
                ['zremrangebyscore', 'statHistory', '-inf', '(' + retentionTime]
            ]).exec(function (err, replies) {
                if (err)
                    logger.error('Error adding stats to historics, err = %s',  JSON.stringify(err));
            });
            callback();
        });

    };

    this.getReadableHashRateString = function (hashrate) {
        var i = -1;























































        var byteUnits = [' KH', ' MH', ' GH', ' TH', ' PH'];
        do {
            hashrate = hashrate / 1000;
            i++;
        } while (hashrate > 1000);
        return hashrate.toFixed(2) + byteUnits[i];
    };











};
