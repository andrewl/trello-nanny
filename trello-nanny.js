check_cards_in_list = function(trello_nanny_config, list, validation_functions_for_list) {
	//Iterate over the users and report on whether they have just one card
	trello.get("/1/list/" + list.id + "/cards", function(err, cards) {
		if (err) throw err;
		for (i = 0; i < cards.length; i++) {
			card = cards[i];
			for (i = 0; i < validation_functions_for_list.length; i++) {
				validation_functions_for_list[i](card);
			}
		}
	});
};

card_has_pull_request = function(card) {
	var has_pull_request = false;
	trello.get("/1/card/" + card.id + "/actions", {
		filter: 'commentCard'
	},
	function(err, actions) {
		if (err) throw err;
		for (i = 0; i < actions.length; i++) {
			if (actions[i].data.text.indexOf('github.com') != - 1) {
				has_pull_request = true;
			}
		}
	});
	if (!has_pull_request) {
		register_nag("No pull request on card " + card.name);
	}
};

card_has_label = function(card, label) {
	ret = false;
	for (i = 0; i < card.labels.length; i++) {
		if (card.labels[i].title == label) {
			ret = true;
		}
	}
	return ret;
};

card_has_labels = function(card, labels) {
	for (i = 0; i < labels.length; i++) {
		if (!card_has_label(card, labels[i])) {
			register_nag("Card '" + card.name + "' does not have label '" + labels[i] + "'");
		}
	}
};

card_has_code_review_labels = function(card) {
	labels = ["Tested manually", "Functionally complete", "Acceptance criteria approved"];
	card_has_labels(card, labels);
};

card_has_todo_labels = function(card) {
	labels = ["Acceptance criteria approved"];
	card_has_labels(card, labels);
};

//Checks to see whether a user has just one card. Posts a message to slack if not
check_user_has_exactly_one_card = function(trello_nanny_config, user) {

	user_open_cards = [];
	user_open_card_names = [];
	for (i = 0; i < user.cards.length; i++) {
		if (trello_nanny_config.boards.indexOf(user.cards[i].idBoard) != - 1) {
			user_open_cards.push(user.cards[i]);
			user_open_card_names.push(user.cards[i].name);
		}
	}

	if (user_open_cards.length < 1) {
		register_nag(user.fullName + " is not listed on any cards");
	}
	else if (user_open_cards.length > 1) {
		register_nag(user.fullName + " is listed on " + user_open_cards.length + " cards: " + user_open_card_names.join(', '));
	}

};

register_nag = function(nag) {
	console.log(nag);
	slack.send({
		text: nag,
		channel: trello_nanny_config.slack_channel,
		username: trello_nanny_config.slack_user
	});
}

require("./config/trello-nanny.config");
var sleep = require('sleep');
var Trello = require("node-trello");
var trello = new Trello(trello_nanny_config.key, trello_nanny_config.token);
var Slack = require('node-slack');
var slack = new Slack(trello_nanny_config.slack_domain, trello_nanny_config.slack_token);

check_user = function(user_id) {
	trello.get("/1/members/" + user_id, {
		cards: "open"
	},
	function(err, user) {
		if (err) throw err;
		check_user_has_exactly_one_card(trello_nanny_config, user);
	});
};

nanny = function() {

	//Iterate over the users and report on whether they have just one card
	for (i = 0; i < trello_nanny_config.users.length; i++) {
		check_user(trello_nanny_config.users[i]);
	}

	//Iterate over the cards and report on whether they have just one card
	for (i = 0; i < trello_nanny_config.boards.length; i++) {
    //@todo - fix this into a sep function
		trello.get("/1/boards/" + trello_nanny_config.boards[i] + "/lists/", function(err, lists) {
			if (err) throw err;

			for (i = 0; i < lists.length; i++) {
				list = lists[i];
				validation_functions_for_list = [];
				if (list.name == 'Code Review') {
					validation_functions_for_list.push(card_has_pull_request, card_has_code_review_labels);
				}
				else if (list.name == 'To Do') {
					validation_functions_for_list.push(card_has_todo_labels);
				}

				if (validation_functions_for_list.length) {
					check_cards_in_list(trello_nanny_config, list, validation_functions_for_list);
				}
			}

		});

	}

	wait_time = 5400 + (Math.random() * 3600);
	console.log("Waiting for " + wait_time + " seconds");
	setTimeout(nanny, wait_time * 1000);

};

nanny();

