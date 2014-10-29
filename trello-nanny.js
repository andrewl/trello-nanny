//Checks to see whether a user has just one card. Posts a message to slack if not
user_has_exactly_one_card = function(trello_nanny_config, user) {

	user_open_cards = [];
	user_open_card_names = [];
	for (i = 0; i < user.cards.length; i++) {
		if (trello_nanny_config.boards.indexOf(user.cards[i].idBoard) != - 1) {
			user_open_cards.push(user.cards[i]);
			user_open_card_names.push(user.cards[i].name);
		}
	}

	if (user_open_cards.length < 1) {
		post_message_to_slack(user.fullName + " is not listed on any cards");
	}
	else if (user_open_cards.length > 1) {
		post_message_to_slack(user.fullName + " is listed on " + user_open_cards.length + " cards: " + user_open_card_names.join(', '));
	}

};

//Posts a message to slack
post_message_to_slack = function(message) {
  console.log(message);
	slack.send({
		text: message,
		channel: trello_nanny_config.slack_channel,
		username: trello_nanny_config.slack_user
	});
};

require("./config/trello-nanny.config");
var Trello = require("node-trello");
var trello = new Trello(trello_nanny_config.key, trello_nanny_config.token);
var Slack = require('node-slack');
var slack = new Slack(trello_nanny_config.slack_domain, trello_nanny_config.slack_token);


//Iterate over the users and report on whether they have just one card
for (i = 0; i < trello_nanny_config.users.length; i++) {
	trello.get("/1/members/" + trello_nanny_config.users[i], {
		cards: "open"
	},
	function(err, user) {
		if (err) throw err;
		user_has_exactly_one_card(trello_nanny_config, user);
	});
}

