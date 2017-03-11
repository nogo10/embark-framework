var Web3 = require('web3');
var async = require('async');
var http = require('http');
var utils = require('./utils.js');

var ServicesMonitor = function(options) {
  this.events = options.events;
  this.logger = options.logger;
  this.checkList = {};
  this.checkTimers = {};
  this.checkState = {};
};

ServicesMonitor.prototype.addCheck = function(name, checkFn, time) {
  this.logger.info('add check');
  // TODO: check if a service with the same name already exists
  this.checkList[name] = {fn: checkFn, interval: time || 5000};
};

ServicesMonitor.prototype.startMonitor = function() {
  var self = this;
  var checkName;

  for (checkName in this.checkList) {
    var check = this.checkList[checkName];

    self.events.on('check:' + checkName, function(obj) {
      self.logger.info(JSON.stringify(obj));
      self.checkState[checkName] = obj.name[obj.status];
      self.events.emit("servicesState", self.checkState);
    });

    this.checkTimers[checkName] = setInterval(function() {
      check.fn.call(check.fn, function(obj) {
        self.events.emit('check:' + checkName, obj);
      });
    }, check.interval);

    check.fn.call(check.fn, function(obj) {
      self.events.emit('check:' + checkName, obj);
    });
  }
};

// TODO: old checks to be moved
ServicesMonitor.prototype.check = function() {
  var self = this;
  async.waterfall([
    function connectWeb3(callback) {
      self.logger.trace('connectWeb3');
      var web3 = new Web3();
      var web3Endpoint = 'http://' + self.config.blockchainConfig.rpcHost + ':' + self.config.blockchainConfig.rpcPort;
      web3.setProvider(new web3.providers.HttpProvider(web3Endpoint));
      callback(null, web3, []);
    },
    function checkEthereum(web3, result, callback) {
      self.logger.trace('checkEthereum');
      var service;
      if (web3.isConnected()) {
        service = (web3.version.node.split("/")[0] + " " + web3.version.node.split("/")[1].split("-")[0] + " (Ethereum)").green;
      } else {
        service = "No Blockchain node found".red;
      }
      result.push(service);
      callback(null, web3, result);
    },
    function checkWhisper(web3, result, callback) {
      self.logger.trace('checkWhisper');
      web3.version.getWhisper(function(err, res) {
        var service = 'Whisper';
        result.push(err ? service.red : service.green);
        callback(null, result);
      });
    }
  ], function(err, result) {
    if (err) {
      self.logger.error(err.message);
    } else {
      self.logger.availableServices(result);
    }
  });
};

module.exports = ServicesMonitor;