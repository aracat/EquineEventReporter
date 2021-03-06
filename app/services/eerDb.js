(function() {
'use strict';

var _dbPath = document.location.protocol + '//' + document.location.hostname + ':5984/eer';
var eerServices = angular.module('errServices', ['ngResource', 'eer.uuid']);

function couchRowsToObjectById(rows, object) {
  rows.forEach(function(r) {
    object[r.id] = r.value;
  });
  return object;
}

eerServices.factory('eerData', ['$resource', '$q', 'alertsManager', 'uuid',
  function($resource, $q, alerts, uuid) {
    var self = this;

    self.data = {};
    self.data.events = {};
    self.data.players = {};
    self.data.matches = {};

    var Event = $resource(_dbPath + "/:id", {}, {
      query: {
        method: "GET",
        isArray: false,
        url: _dbPath + "/_design/eer/_view/events"
      }
    });

    var Player = $resource(_dbPath + "/:id", {}, {
      query: {
        method: "GET",
        isArray: false,
        url: _dbPath + "/_design/eer/_view/players"
      }
    });

    var Match = $resource(_dbPath + "/:id", {}, {
      query: {
        method: "GET",
        isArray: false,
        url: _dbPath + "/_design/eer/_view/matches"
      },
      saveBulk: {
        method: "POST",
        isArray: true,
        url: _dbPath + "/_bulk_docs"
      }
    });
    
    self.loadEvents = function() {
      return Event.query().$promise
        .then(function(res) {
          return couchRowsToObjectById(res.rows, self.data.events);
        })
        .catch(function(error) {
          alerts.addAlert(error);
        });
    };

    self.loadEvent = function(id) {
      return Event.get({id: id}).$promise
        .then(function(res) {
          self.data.events[id] = res;
          return self.data.events[id];
        })
        .catch(function(error) {
          alerts.addAlert(error);
        });
    };
    
    self.saveEvent = function(event) {
      return Event.save(event).$promise
        .then(function(res) {
          event._rev = res.rev;
          self.data.events[event._id] = event;
          return res;
        })
        .catch(function(error) {
          alerts.addAlert(error);
          return error;
        });
    };
    
    self.removeEvent = function(event) {
      return Event.delete({id: event._id, rev: event._rev}).$promise
        .then(function(res) {
          delete self.data.events[res.id];
          // Make sure the players are loaded.
          self.loadPlayers(event).then(function() {
            // TODO: Make this a bulk operation.
            event.players.forEach(function(pID) {
              Player.delete({id: pID, rev: self.data.players[pID]._rev})
                .$promise.then(function(res) {
                  delete self.data.players[res.id];
                  return res;
                });
            });
            return res;
          });
        })
        .catch(function(error) {
          alerts.addAlert(error);
          return error;
        });
    };
    
    self.loadPlayers = function(event) {
      var queryParams = {};
      
      if (event !== undefined)
        queryParams.keys = JSON.stringify(event.players);
      
      return Player.query(queryParams).$promise
        .then(function(res) {
          // Update cache
          couchRowsToObjectById(res.rows, self.data.players);
          if (event === undefined)
            return self.data.players;
          var ret = {};
          return couchRowsToObjectById(res.rows, ret);
        })
        .catch(function(error) {
          alerts.addAlert(error);
        });
    };

    self.loadMatches = function(event) {
      var queryParams = {};
      
      if (event !== undefined)
        queryParams.key = JSON.stringify([event._id]);
      
      return Match.query(queryParams).$promise
        .then(function(res) {
          // Update cache
          couchRowsToObjectById(res.rows, self.data.matches);
          if (event === undefined)
            return self.data.matches;
          var ret = {};
          return couchRowsToObjectById(res.rows, ret);
        })
        .catch(function(error) {
          alerts.addAlert(error);
        });
    };
    
    self.getMatches = function(event) {
      var ret = [];
      for (var i in self.data.matches) {
        if (self.data.matches[i].event === event._id)
          ret.push(self.data.matches[i]);
      }
      return ret;
    };
    
    self.saveMatches = function(matches) {
      return Match.saveBulk({docs: matches}).$promise
        .then(function(res) {
          matches.forEach(function(m) {
            if (m._deleted)
              return;
            self.data.matches[m._id] = m;
          });
          res.forEach(function(r) {
            if (self.data.matches[r.id])
              self.data.matches[r.id]._rev = r.rev;
          });
          return matches;
        });
    };
    
    self.saveMatch = function(match) {
      return Match.save(match).$promise
        .then(function(res) {
          match._rev = res.rev;
          return res;
        })
        .catch(function(error) {
          alerts.addAlert(error);
          return error;
        });
    };
    
    self.resetMatches = function(event) {
      var matches = [];
      for (var i in self.data.matches) {
        var m = self.data.matches[i];
        if (m.event !== event._id)
          continue;
        delete self.data.matches[i];
        m._deleted = true;
        matches.push(m);
      }
      event.current_round = 1;
      return $q.all([self.saveMatches(matches), self.saveEvent(event)]);
    };

    self.unpairLastRound = function(event) {
      --event.current_round;
      if (event.current_round < 1)
        event.current_round = 1;

      var round = event.current_round;
      var matches = [];
      for (var i in self.data.matches) {
        var m = self.data.matches[i];
        if (m.event === event._id && m.round === round) {
          m._deleted = true;
          matches.push(m);
          delete self.data.matches[i];
        }
      }
      return self.saveMatches(matches)
        .then(function(res) {
          self.saveEvent(event);
          return self.loadMatches(event);
        });
    };

    self.removeMatch = function(match) {
      return Match.delete({id: match._id, rev: match._rev}).$promise
        .then(function(res) {
          delete self.data.matches[match._id];
          return res;
        })
        .catch(function(error) {
          alerts.addAlert(error);
          return error;
        });
    };
    
    self.addPlayer = function(event, name) {
      var player = {
        _id: "player." + uuid(),
        type: "player",
        paid: true,
        name: name
      };

      this.name = "";

      return Player.save(player)
        .$promise.then(function(res) {
          player._rev = res.rev;
          event.players.push(player._id);
          self.data.players[player._id] = player;
          return Event.save(event).$promise;
        })
        .then(function(res) {
          event._rev = res.rev;
          return player;
        })
        .catch(function(error) {
          alerts.addAlert(error);
          return error;
        });
    };
    
    self.savePlayer = function(player) {
      return Player.save(player).$promise
        .then(function(res) {
          player._rev = res.rev;
        })
        .catch(function(error) {
          alerts.addAlert(error);
          return error;
        });
    };
    
    self.removePlayer = function(player, event) {
      return Player.delete({id: player._id, rev: player._rev}).$promise
        .then(function(res) {
          delete self.data.players[res.id];
          var index = event.players.indexOf(player._id);
          if (index !== -1) {
            event.players.splice(index, 1);
            return self.saveEvent(event);
          }
          return res;
        })
        .catch(function(error) {
          alerts.addAlert(error);
          return error;
        });
    };
    
    self.getPlayers = function(event) {
      var ret = [];
      event.players.forEach(function(p) {
        ret.push(self.data.players[p]);
      });
      return ret;
    };
    
    self.mergeEvents = function(name, events) {
      var newEvent = {
        _id: 'event.' + Date.now() + uuid(),
        type: 'event',
        name: name,
        current_round: 1,
        players: [],
        done: false,
        eventType: "swiss"
      };
      
      var promises = [];
      
      for (var i in events) {
        var event = self.data.events[events[i]];
        newEvent.current_round = Math.max(newEvent.current_round, event.current_round);
        newEvent.players = newEvent.players.concat(event.players);
        promises.push(self.loadMatches(event));
      }
      
      promises.push(self.saveEvent(newEvent));
      
      return $q.all(promises).then(function() {
        var newMatches = [];
        for (var i in events) {
          var matches = self.getMatches(self.data.events[events[i]]);
          for (var j in matches) {
            var m = matches[j];
            // Yeah, this is a bad way to copy an object. Oh well.
            var newMatch = JSON.parse(JSON.stringify(m));
            newMatch._id = "match." + uuid();
            newMatch.event = newEvent._id;
            newMatches.push(newMatch);
          }
        }
        return self.saveMatches(newMatches)
          .then(function() {
            self.data.events[newEvent._id] = newEvent;
          });
      });
    };
    
    return self;
  }]);
})();
