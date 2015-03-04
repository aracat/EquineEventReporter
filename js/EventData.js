app.factory('EventData', function() {
  var EventData = {
    data: {
      events: [
        {
          id: "event.w4yfhwo874f",
          name: "Tournament 1",
          type: "swiss",
          players: ["player.398ruw3", "player.4fis93kd"],
          current_round: 1,
          done: false
        }
      ],
      players: [
        {
          id: "player.398ruw3",
          name: "Bigcheese",
          deck: "",
          paid: true,
          dropped: false,
          warning_count: 0
        },
        {
          id: "player.4fis93kd",
          name: "Aracat",
          deck: "",
          paid: true,
          dropped: false,
          warning_count: 0
        },
       {
          id: "player.4fie93kd",
          name: "Bugle",
          deck: "",
          paid: true,
          dropped: false,
          warning_count: 0
        },
        {
          id: "player.4fdfis93kd",
          name: "Gippy",
          deck: "",
          paid: true,
          dropped: false,
          warning_count: 0
        },
        {
          id: "player.4fis9sef3kd",
          name: "TCO",
          deck: "",
          paid: true,
          dropped: false,
          warning_count: 0
        }
      ],
      matches: [
        {
          id: "match.309f3",
          event: "event.w4yfhwo874f",
          round: 1,
          players: ["player.398ruw3", "player.4fis93kd"],
          games: [{winner: "player.398ruw3"}],
          winner: "player.398ruw3",
          time_extension: 0
        },
        {
          id: "match.309f3",
          event: "event.w4yfhwo874f",
          round: 2,
          players: ["player.398ruw3", "player.4fis93kd"],
          games: [{winner: "player.398ruw3"}],
          winner: "player.4fis93kd",
          time_extension: 0
        }
      ]
    },
    players: function(event) {
      var playerIds = event.players
      var ret = []
      for (i in this.data.players) {
        var player = this.data.players[i]
        if ($.inArray(player.id, playerIds.some)) {
          ret.push(player)
        }
      }
      return ret
    },
    matches: function(event) {
      return $.grep(this.data.matches, function(match) {
        return match.event === event.id
      })
    },
    player: function(playerId) {
      return $.grep(this.data.players, function(player) {
        return player.id === playerId
      })[0]
    },
  }
  return EventData
})
