//initialize a Chat singleton
var Chat =  (function(){
    var setCookie = function(c_name,value,exdays){
        var exdate=new Date();
        exdate.setDate(exdate.getDate() + exdays);
        var c_value=escape(value) + ((exdays==null) ? "" : "; expires="+exdate.toUTCString());
        document.cookie=c_name + "=" + c_value;
    };

    var getCookie = function(c_name){
        var i,x,y,ARRcookies=document.cookie.split(";");
        for (i=0;i<ARRcookies.length;i++)
        {
            x=ARRcookies[i].substr(0,ARRcookies[i].indexOf("="));
            y=ARRcookies[i].substr(ARRcookies[i].indexOf("=")+1);
            x=x.replace(/^\s+|\s+$/g,"");
            if (x==c_name)
            {
                return unescape(y);
            }
        }
    };

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
     * 5) RENAME, when the user renames there user id
     * 6) ERROR, when something bad happens, disconnect or error on PUBNUB
     */
    var TYPES = {JOIN: 1, JOIN_ACK:2, CHAT: 3, LEAVE: 4, RENAME: 5, ERROR:6 };
    //get the previous UID stored in the CHAT_UID cookie
    var UID = getCookie('CHAT_UID');
    var USERNAME = getCookie('CHAT_USERNAME');
    if(USERNAME === undefined){
        USERNAME = null;

    }
            

    var from_session = 1;
    if(UID === undefined){
         UID = Date.UTC(now.getYear(),now.getMonth(),now.getDay(),now.getHours(),now.getMinutes(),now.getSeconds(),now.getMilliseconds());
         from_session = 0;
    } 
    
    setCookie('CHAT_UID',UID,1);
    //create a message to be sent over PUBNUB
    var createMsg = function(type,message){
        return {'user':UID,'type':type, 'payload':message};

    };

    /**
     * append a message to the words div, given a message object(from createMsg)
     *
     * @param Object
     * @return void
     */
    var appendMsg = function(message){
        var usr = users[message.user] === null || users[message.user] === undefined? message.user: users[message.user];
        if(message.type === TYPES.CHAT ){
            document.getElementById('words').innerHTML += '<div class="word'+message.type+'"><div class="rounded shadow"><span class="user">'+usr+' </span><span class="payload">'+message.payload+'</span></div></div>';
        }
        else{
            document.getElementById('words').innerHTML += '<div class="word'+message.type+'"><div class="rounded"><span class="payload">'+message.payload+'</span></div></div>'; 

        }
        //keep scroll position on the bottom
        document.getElementById('words').scrollTop = document.getElementById('words').scrollHeight;
    };

    //binary flag used by rename so not to show the input when it's already shown
    var showing = 0;

    /**
     * rename the user on the DOM Element and in the users array
     *
     * @param string
     * @param string
     * @return void
     */
    var rename_user = function(user_id,user_name){
        users[user_id] = user_name;
        if(user_id === UID){
            setCookie('CHAT_USERNAME',user_name);
        }
        var inner = user_name; 

        if(user_id === UID){
            inner = '<a href="#" onclick="Chat.rename(this.parentNode,'+user_id+')">'+user_name+'</a>';

        }

        document.getElementById('user'+user_id).innerHTML = inner;

    };

    /**
     * handle a rename event, when the user hits enter in the rename input box
     *
     * @param Object
     * @param string
     * @param string
     * @return void
     */
    var renameSubmit = function(e,user_name,user_id){
        if(e.keyCode === 13){
            user_id = user_id === null? UID:user_id;
            showing = 0;
            PUBNUB.publish({'channel':'chat_room',message:createMsg(TYPES.RENAME,user_name)});
            rename_user(user_id,user_name);

        }

    };

    /**
     * show the rename user interface by showing a input box for the user to type
     *
     * @param DOMElement
     * @param string
     * @return void
     */
    var rename = function(el,user_id){
        var user_name = users[user_id] !== null? users[user_id] : user_id;
        if(!showing){ 
            el.innerHTML = '<input id="rename-user" onkeyup="Chat.renameSubmit(event,this.value,null)" type="text" value="'+user_name+'" name="rename" />';
            showing = 1;

        }
    };


    /**
     * append a user to the users div, given the user id and user name
     *
     * @param string
     * @param string
     * @return void
     */
    var appendUsr = function(user_id,user_name){
        if(users[user_id] === undefined){
            users[user_id] = user_name;
            var inner = user_id; 
            if( user_name !== null && user_name !== undefined  ){
                inner = user_name;

            }

            if(user_id === UID){
                inner = '<a href="#" onclick="Chat.rename(this.parentNode,'+user_id+');">'+inner+'</a>'

            }

            document.getElementById('users').innerHTML += '<li id="user' + user_id + '" >'+inner+'</li>';
        }

    };

    /**
     * remove a user fromt he users div
     *
     * @param string
     * @return void
     */
    var removeUsr = function(user_id) {
        var user_li = document.getElementById('user'+user_id);

        if(user_li !== null){
            delete users[user_id];
            document.getElementById('users').removeChild(user_li);
        }

    };

    /**
     * when the user closes the browser notify the other users the UID no longer exists
     * this only handles the browser close use case, not browser refresh
     */
    window.onbeforeunload = function(e){
      PUBNUB.publish({
         'channel': 'chat_room',
         'message': createMsg(TYPES.LEAVE, users[UID] === null?UID:users[UID])

       });

    };


    var subscribe = function(){
        //subscribe to the chat room
        PUBNUB.subscribe({
         'channel': "chat_room",
         'restore': false,
         'callback': function(message) { 
            if(message.type === TYPES.JOIN){
                var payload = UID;
                if(users[UID] !== null){
                    payload = users[UID];
                    
                }
                PUBNUB.publish({
                    channel:"chat_room",
                    message:createMsg(TYPES.JOIN_ACK, payload )
                });

                appendMsg(message);
            }
            else if(message.type === TYPES.JOIN_ACK && users[message.user] === undefined){
                if(message.user !== UID){
                    appendUsr(message.user,message.payload);

                }

            }
            else if(message.type === TYPES.CHAT){
                appendMsg(message);

            }
            else if(message.type === TYPES.LEAVE){
                if(message.user != UID){
                    removeUsr(message.payload);
                    appendMsg(createMsg(TYPES.LEAVE,message.payload + ' has left'));
                }

            }
            else if(message.type === TYPES.RENAME){
               rename_user(message.user,message.payload);

            }
        },
        'disconnect': function() {        // LOST CONNECTION.
            appendMsg(createMsg(TYPES.ERROR,'You disconnected'));

        },
        'reconnect': function() {        // CONNECTION RESTORED.
            /*PUBNUB.publish({
                'channel': 'chat_room',
                'message': createMsg(TYPES.JOIN, UID)

            });
            */

        },
        'error': function(msg){
            appendMsg(createMsg(TYPES.ERROR,'There was an unknown error'));

        },
        'connect': function() {        // CONNECTION ESTABLISHED.
           var msg = USERNAME === null?UID:USERNAME;
           PUBNUB.publish({             // SEND A MESSAGE.
             channel : "chat_room",
             message : createMsg(TYPES.JOIN, msg + " connected ..."),
             callback:function(info){
               appendUsr(UID,USERNAME);

             }
           });
                        
             
        }

    });

    }

    subscribe();
    
    


return {'createMsg': createMsg,'TYPES': TYPES, 'rename': rename,'renameSubmit':renameSubmit };
})();
