chrome.extension.sendMessage({}, function(response) {
	var readyStateCheckInterval = setInterval(function() {
  	if (document.readyState === "complete") {
  		clearInterval(readyStateCheckInterval);

      /**
       * Start.
       */

      chrome.storage.local.get(['oauth_token', 'oauth_token_secret', 'user_id'], function(items) {
        if (!items.oauth_token || !items.oauth_token_secret) return;
        refresh(items);
        setInterval(function() { return refresh(items) }, 5000);
      });

      /**
       * Refresh when new tweets appear in DOM.
       */

      function refresh(auth) {
        var users = formatUsers(getUsersFromTimeline());
        if (users.length > 10) {
          for (var i = 0; i < users.length; i++) {
            getScore(users[i], auth);
          }
        }
        update();
      }

      /**
       * Get users dictionary from timeline.
       */

      function getUsersFromTimeline () {
        var tweets = document.querySelectorAll('div.tweet');
        var users = {};
        for (var i = 0; i < tweets.length; i++) {
          if (tweets[i].getAttribute('data-scraped') === 'true') continue;
          var user_id = tweets[i].getAttribute('data-user-id');
          var screen_name = tweets[i].getAttribute('data-screen-name');
          if (!user_id || !screen_name) continue;
          if (users[user_id]) continue;
          users[user_id] = screen_name;
          tweets[i].setAttribute('data-scraped', 'true');
        }
        return users;
      }

      /**
       * Get bot score for user.
       * @param {Object} user { user_id: Number, screen_name: String }
       * @param {Object} auth { oauth_token: String, oauth_token_secret: String }
       */

      function getScore(user, auth) {
        var xhttp = new XMLHttpRequest();
        xhttp.open('POST', 'https://askbotson.herokuapp.com/api/', true);
        xhttp.setRequestHeader("Content-Type", "application/json");
        xhttp.setRequestHeader("x-twitter-oauth-token", auth.oauth_token);
        xhttp.setRequestHeader("x-twitter-oauth-secret", auth.oauth_token_secret);
        if (auth.user_id) xhttp.setRequestHeader("x-twitter-user-id", auth.user_id);
        xhttp.send(JSON.stringify(user));
        xhttp.onload = saveUsers;
      }

      /**
       * Update users.
       */

      function saveUsers(e) {
        var res = JSON.parse(e.target.response);
        chrome.storage.local.get(null, function(items) {
          if (items[res.user_id]) return;
          items[res.user_id] = { screen_name: res.screen_name, score: res.scores.english };
          chrome.storage.local.set(items);
        });
      }

      /**
       * Update dom.
       */

      function update() {
        var tweets = document.querySelectorAll('div.tweet');
        chrome.storage.local.get(null, function(items) {
          var users = items;
          for (var i = 0; i < tweets.length; i++) {
            for (var userId in users) {
              if (tweets[i].getAttribute('data-updated') === 'true') continue;
              if (tweets[i].getAttribute('data-user-id') !== userId.toString()) continue;
              if (users[userId].score > 0.6) {
                tweets[i].className += ' probably-a-bot';
                tweets[i].parentNode.insertBefore(createMask(users[userId], tweets[i].scrollHeight), tweets[i]);
              }
              tweets[i].setAttribute('data-updated', 'true');
            }
          }
        });
      }

      /**
       * Create mask and message div.
       */

      function createMask(user, height) {
        var mask = document.createElement('div');
        var message = document.createElement('div');
        mask.className = 'probably-a-bot-mask';
        message.className = 'probably-a-bot-mask-message-short';
        if (height > 150) message.className = 'probably-a-bot-mask-message-medium';
        if (height > 300) message.className = 'probably-a-bot-mask-message-tall';
        message.innerHTML = 'We are ' + (100 * user.score) + '% confident that this tweet is from a bot.';
        message.innerHTML += '<p style="font-size: 0.8rem"><a href="#/" class="reveal-tweet">Reveal tweet</a>. <a href="https://botometer.iuni.iu.edu/#!/?sn=' + user.screen_name + '" target="_blank">Learn more about this account</a>.</p>';
        mask.appendChild(message);
        message.childNodes[1].childNodes[0].addEventListener('click', function(e) {
          this.parentNode.parentNode.parentNode.parentNode.childNodes[2].classList.remove('probably-a-bot')
          this.parentNode.parentNode.parentNode.parentNode.removeChild(this.parentNode.parentNode.parentNode)
        });
        return mask;
      }

      /**
       * Format user dictionary into tiny pieces.
       */

      function formatUsers(users) {
        var arr = [];
        for (var property in users) {
          if (users.hasOwnProperty(property)) {
            if (property) arr.push({ user_id: '' + property, screen_name: users[property] });
          }
        }
        return arr;
      }
  	}
	}, 10);
});



