var Chat =  (function(){
    //current date stamp for generating a UID
    var now = new Date();
    //current name of the user, if none uses UID
    var chat_name = null;
    //current set of users on chat
    var users = {};
    /**
     * the different types of messages
     * 1) JOIN, when a users joins this is sent out to notify all users someone has joined the chat 
     * 2) JOIN_ACK, a response from the other users in the chat room to notify the user that just joined who else is there
     * 3) CHAT, primary type, for sending standard chat messages
     * 4) LEAVE, when someone leaves chat, notifies users to remove them from there user set
     */
    var TYPES = {JOIN: 1, JOIN_ACK:2, CHAT: 3, LEAVE: 4};

    //the UID of the user, which is the the UTC timestamp
    var UID = Date.UTC(now.getYear(),now.getMonth(),now.getDay(),now.getHours(),now.getMinutes(),now.getSeconds(),now.getMilliseconds());

    //create a message to be sent over PUBNUB
    var createMsg = function(type,message){
        return {'user':UID,'type':type, 'payload':message};

    };

    //append a message to the words div, given a message object(from createMsg)
    var appendMsg = function(message){
        document.getElementById('words').innerHTML += '<div class="word">'+message.payload+'</div>'; 
    };

    //append a user to the users div, given the user id and user name
    var appendUsr = function(user_id,user_name){
        users[user_id] = user_name;
        document.getElementById('users').innerHTML += '<li id="user-' + user_id + '">'+user_id+'</li>';
    };

    //remove a user fromt he users div
    var removeUsr = function(user_id) {
        var user_li = document.getElementById('user-'+user_id);
        if(user_li !== null){
          delete users[user_id];
          document.getElementById('users').removeChild(user_li);
        }

    };
    
    //subscribe to the chat room
    PUBNUB.subscribe({
        'channel': "chat_room",
        'restore': false,
        'callback': function(message) { 
            if(message.type === TYPES.JOIN){
                PUBNUB.publish({
                    channel:"chat_room",
                    message:createMsg(TYPES.JOIN_ACK,chat_name === null? chat_name: UID )
                });

                appendMsg(message);
            }
            else if(message.type === TYPES.JOIN_ACK && users[message.user] === undefined){
                appendUsr(message.user,message.payload);

            }
            else if(message.type === TYPES.CHAT){
                appendMsg(message);

            }
            else if(message.type === TYPES.LEAVE){
                removeUsr(message.uid);

            }
        },
        'disconnect': function() {        // LOST CONNECTION.
            PUBNUB.publish({
                'channel': 'chat_room',
                'message': createMsg(TYPES.LEAVE, UID)

            });
        },
        'reconnect': function() {        // CONNECTION RESTORED.
            PUBNUB.publish({
                'channel': 'chat_room',
                'message': createMsg(TYPES.JOIN, UID)

            });
        },
        'error': function(msg){
            appendMsg(createMsg(TYPES.CHAT,msg));

        },
        'connect': function() {        // CONNECTION ESTABLISHED.
            PUBNUB.publish({             // SEND A MESSAGE.
                channel : "chat_room",
                message : createMsg(TYPES.JOIN,"User " + UID + " connected ...") 
            });
    }

});

return {'createMsg': createMsg,'TYPES': TYPES };
})();
