const EventEmitter = require("events");
const io = require("socket.io-client");

module.exports = nodecg => {
    if(!nodecg.bundleConfig) {
        nodecg.log.error("No bundleConfig found, nodecg-streamlabs will not work without a configuration. Exiting.");
        return;
    } else if(typeof nodecg.bundleConfig.socket_token !== "string") {
        nodecg.log.error("No socket_token value present in bundleConfig, nodecg-streamlabs will not work without a socket_token. Exiting");
        return;
    }

    // Default options
    let opts = {
        reconnect: true
    };
    // Apply options to defaults if they exist
    if(typeof nodecg.bundleConfig.socketio === "object") {
        for(let i in nodecg.bundleConfig.socketio) {
            opts[i] = nodecg.bundleConfig.socketio[i];
        }
    }

    let socket = io.connect(`https://sockets.streamlabs.com/?token=${nodecg.bundleConfig.socket_token}`, opts);
    let emitter = new EventEmitter();

    socket.on("event", event => {
        // For people who wanna handle some of the dirty work themselves
        nodecg.sendMessage("rawEvent", event);
        emitter.emit("rawEvent", event);

        // This wouldn't be necessary if it weren't for the rogue 'streamlabels' event that is not an array
        let unformatted = event.message instanceof Array ? event.message.pop() : event.message;
        
        // No message? Must be an error, so we skip it because we already do raw emits.
        if(!(unformatted instanceof Object)) {
            nodecg.log.error(`Event ${event.event_id} had no ites in its event.message property, skipping.`);
            return;
        }

        nodecg.log.debug("New streamlabs event: " + event.type);

        switch(event.type) {
            case "donation": {
                // Donations are StreamLabs specific
                let message = {
                    id: unformatted.id || unformatted._id || null,
                    name: unformatted.name,
                    amount: {
                        amount: unformatted.amount,
                        currency: unformatted.currency
                    },
                    formatted_amount: unformatted.formatted_amount,
                    message: unformatted.message
                };
                let type_message = {
                    type: "donation",
                    message
                };
                nodecg.sendMessage("donation", message);
                emitter.emit("donation", message);

                nodecg.sendMessage("streamlabs-event", type_message);
                emitter.emit("streamlabs-event", type_message);
                break;
            }
            case "streamlabscharitydonation": {
                // Donations for streamlabscharity
                let message = {
                    id: unformatted.id || unformatted._id || null,
                    name: unformatted.from,
                    amount: {
                        amount: unformatted.amount,
                        currency: unformatted.currency
                    },
                    formatted_amount: unformatted.formatted_amount,
                    message: unformatted.message
                };
                let type_message = {
                    type: "streamlabscharitydonation",
                    message
                };
                nodecg.sendMessage("streamlabscharitydonation", message);
                emitter.emit("streamlabscharitydonation", message);

                nodecg.sendMessage("streamlabscharity-event", type_message);
                emitter.emit("streamlabscharity-event", type_message);
                break;
            }
            case "follow": {
                // Twitch follow == YouTube subscription
                let message = {
                    id: unformatted.id || unformatted._id || null,
                    name: unformatted.name,
                    when: unformatted.created_at || unformatted.publishedAt || null
                };
                let type_message = {
                    type: "follow",
                    message
                };

                if(event.for === "twitch_account") {
                    nodecg.sendMessage("twitch-follow", message);
                    emitter.emit("twitch-follow");

                    nodecg.sendMessage("twitch-event", type_message);
                    emitter.emit("twitch-event", type_message);
                } else if(event.for === "youtube_account") {
                    nodecg.sendMessage("youtube-subscription", message);
                    emitter.emit("youtube-subscription", message);

                    nodecg.sendMessage("youtube-event", type_message);
                    emitter.emit("youtube-event", type_message);
                }
                break;
            }
            case "subscription": {
                // Twitch sub == YouTube sponsor
                let message = {
                    id: unformatted.id || unformatted._id || null,
                    name: unformatted.name,
                    message: unformatted.message || null,
                    months: unformatted.months || 1
                };
                let type_message = {
                    type: "subscription",
                    message
                };

                if(event.for === "twitch_account") {
                    nodecg.sendMessage("twitch-subscription", message);
                    emitter.emit("twitch-subscription", message);

                    nodecg.sendMessage("twitch-event", type_message);
                    emitter.emit("twitch-event", type_message);
                } else if(event.for === "youtube_account") {
                    nodecg.sendMessage("youtube-sponsor", message);
                    emitter.emit("youtube-sponsor", message);

                    type_message.type = "sponsor";
                    nodecg.sendMessage("youtube-event", type_message);
                    emitter.emit("youtube-event", type_message);
                }
                break;
            }
            case "host": {
                // Twitch host, no YouTube equivalent
                let message = {
                    id: unformatted.id || unformatted._id || null,
                    name: unformatted.name,
                    viewers: Number(unformatted.viewers),
                    type: unformatted.type
                };
                let type_message = {
                    type: "host",
                    message
                };

                if(event.for === "twitch_account") {
                    nodecg.sendMessage("twitch-host", message);
                    emitter.emit("twitch-host", message);

                    nodecg.sendMessage("twitch-event", type_message);
                    emitter.emit("twitch-event", type_message);
                }
                break;
            }
            case "bits":
            case "superchat": {
                // Twitch bits == YouTube superchats
                let message = {
                    id: unformatted.id || unformatted._id || null,
                    name: unformatted.name,
                    amount:  unformatted.amount,
                    message: unformatted.message || unformatted.comment || null
                };

                if(event.for == "twitch_account") {
                    nodecg.sendMessage("twitch-bits", message);
                    emitter.emit("twitch-bits", message);

                    let type_message = {
                        type: "bits",
                        message
                    };
                    nodecg.sendMessage("twitch-event", type_message);
                    emitter.emit("twitch-event", type_message);
                } else if(event.for === "youtube_account") {
                    // There are some extra values we wanna add to the message if it's for youtube
                    message.currency = unformatted.currency;
                    message.display_string = unformatted.displayString;
                    nodecg.sendMessage("youtube-superchat", message);
                    emitter.emit("youtube-superchat", message);

                    let type_message = {
                        type: "superchat",
                        message
                    };
                    nodecg.sendMessage("youtube-event", type_message);
                    emitter.emit("youtube-event", type_message);
                }
                break;
            }
            case "raid": {
                // Twitch raid, I don't believe there's an equivalent for Youtube
                let message = {
                    id: unformatted.id || unformatted._id || null,
                    name: unformatted.name,
                    viewers: unformatted.raiders
                };
                let type_message = {
                    type: "raid",
                    message
                };

                nodecg.sendMessage("twitch-raid", message);
                emitter.emit("twitch-raid", message);

                nodecg.sendMessage("twitch-event", type_message);
                emitter.emit("twitch-event", type_message);
                break;
            }
            case "streamlabels": {
                let message = unformatted;

                message.id = unformatted.id || unformatted._id || null,

                nodecg.sendMessage("streamlabels", message);
                emitter.emit("streamlabels", message);
                break;
            }
            default:
                // We don't really need a default here, as we emit all events anyways under rawEvent
                break;
        }
    });

    return emitter;
};
