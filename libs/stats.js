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




/**
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
                ['scard', ':blocksOrphaned']







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






                        var coinStats = {
                            name: coinName,
                            symbol: poolConfigs[coinName].coin.symbol.toUpperCase(),
                            algorithm: poolConfigs[coinName].coin.algorithm,
                            hashrates: replies[i + 1],
                            poolStats: {
                                validShares: replies[i + 2] ? (replies[i + 2].validShares || 0) : 0,
                                validBlocks: replies[i + 2] ? (replies[i + 2].validBlocks || 0) : 0,
                                invalidShares: replies[i + 2] ? (replies[i + 2].invalidShares || 0) : 0,
                                totalPaid: replies[i + 2] ? (replies[i + 2].totalPaid || 0) : 0







                            },


                            blocks: {
                                pending: replies[i + 3],
                                confirmed: replies[i + 4],
                                orphaned: replies[i + 5]
                            }















                        };











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

                for (var worker in coinStats.workers) {
                    coinStats.workers[worker].hashrateString = _this.getReadableHashRateString(shareMultiplier * coinStats.workers[worker].shares / portalConfig.website.stats.hashrateWindow);











                }





































                delete coinStats.hashrates;
                delete coinStats.shares;
                coinStats.hashrateString = _this.getReadableHashRateString(coinStats.hashrate);
            });

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
