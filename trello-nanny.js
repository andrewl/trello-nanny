check_cards_in_list = function(trello_nanny_config, list, validation_functions_for_list) {
	//Iterate over the users and report on whether they have just one card
	trello.get("/1/list/" + list.id + "/cards", function(err, cards) {
		if (err) throw err;
		for (i = 0; i < cards.length; i++) {
			card = cards[i];
			for (j = 0; j < validation_functions_for_list.length; j++) {
				validation_functions_for_list[j](card);
			}
		}
	});
};

card_has_pull_request = function(card) {
	trello.get("/1/card/" + card.id + "/actions", {
		filter: 'commentCard'
	},
	function(err, actions) {
		if (err) throw err;
	  has_pull_request = false;
		for (i = 0; i < actions.length; i++) {
			if (actions[i].data.text.indexOf('github.com') != - 1) {
				has_pull_request = true;
			}
		}
    if (!has_pull_request) {
      register_nag("No pull request on card " + card.name);
    }
	});
};


card_get_most_recent_member = function(card) {
  var ret;
	trello.get("/1/card/" + card.id + "/actions", {
		filter: 'addMemberToCard'
	},
	function(err, actions) {
		if (err) throw err;
    if (actions.length === 0) {
      ret = false;
    }
    else {
     ret = actions[0].member.username;
    }
	});
  return ret;
};

card_has_label = function(card, label) {
	var ret = false;
  //console.log('looking for ' + label);
	for (cl = 0; cl < card.labels.length; cl++) {
    //console.log(card.labels[cl]);
		if (card.labels[cl].name == label) {
      //console.log(card.name + " has label " + label);
			ret = true;
		}
    else {
      //console.log(card.labels[cl].title);
    }
	}
	return ret;
};

card_has_labels = function(card, labels) {
  missing_labels = [];
	for (l = 0; l < labels.length; l++) {
		if (!card_has_label(card, labels[l])) {
      //console.log('a missing label - ' + labels[i]);
      missing_labels.push(labels[l]);
		}
	}
  if (missing_labels.length) {
    register_nag("Card '" + card.name + "' does not have '" + missing_labels.join(',') + "'");
  }
};

card_has_code_review_labels = function(card) {
	labels = ["Tested manually", "Functionality complete", "Acceptance criteria approved", "Automated tests passing"];
	card_has_labels(card, labels);
};

card_has_todo_labels = function(card) {
	labels = ["Acceptance criteria approved"];
	card_has_labels(card, labels);
};

card_has_dev_test_labels = function(card) {
	labels = ["Tested manually", "Functionality complete", "Acceptance criteria approved", "Automated tests passing"];
	card_has_labels(card, labels);
};

card_has_awaiting_release_labels = function(card) {
	labels = ["Tested manually", "Functionality complete", "Acceptance criteria approved", "Automated tests passing", "Peer reviewed"];
	card_has_labels(card, labels);
};

card_has_uat_labels = function(card) {
	labels = ["Tested manually", "Functionality complete", "Acceptance criteria approved", "Automated tests passing", "Peer reviewed"];
	card_has_labels(card, labels);
};


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
};

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
		user_has_exactly_one_card(trello_nanny_config, user);
	});
};

check_board = function(board_id) {
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
			else if (list.name == 'Dev Test') {
				validation_functions_for_list.push(card_has_dev_test_labels);
			}
			else if (list.name == 'Awaiting Release') {
				validation_functions_for_list.push(card_has_awaiting_release_labels);
			}
			else if (list.name == 'UAT') {
				validation_functions_for_list.push(card_has_uat_labels);
			}

			if (validation_functions_for_list.length) {
				check_cards_in_list(trello_nanny_config, list, validation_functions_for_list);
			}
		}
	});
};

nanny = function() {

	//Iterate over the users and report on whether they have just one card
	for (i = 0; i < trello_nanny_config.users.length; i++) {
		check_user(trello_nanny_config.users[i]);
	}

	//Iterate over the cards and report on whether they have just one card
	for (i = 0; i < trello_nanny_config.boards.length; i++) {
		check_board(trello_nanny_config.boards[i]);
	}

	wait_time = 5400 + (Math.random() * 3600);
	console.log("Waiting for " + wait_time + " seconds");
	setTimeout(nanny, wait_time * 1000);

};

nanny();

