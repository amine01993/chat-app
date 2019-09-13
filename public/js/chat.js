(function () {

    const socket = io()
    const parser = new DOMParser()
    const connectedUserId = document.getElementById('connected-user').value

    const channelItemTemplate = `<li class="collection-item avatar">
        <div class="badged-circle">
            <img class="circle" src="//cdn.shopify.com/s/files/1/1775/8583/t/1/assets/portrait1.jpg?0" alt="avatar">
        </div>
        <span class="title">Jane Doe</span>
    </li>`

    const channelsList = document.getElementById('channels-list')
    const chatCard = document.getElementById('chat-card')
    const chatWith = chatCard.querySelector('.card-title')
    const chatHistoryList = chatCard.querySelector('.chat-wrapper')
    const msgForm = chatCard.querySelector('#message-form')
    const msgInput = chatCard.querySelector('#message-input')

    const messageTemplate = `<div class="chat-message">
        <img class="circle" src="//cdn.shopify.com/s/files/1/1775/8583/t/1/assets/portrait1.jpg?0" alt="avatar">
        <span class="message">
            Lo-fi you probably haven't heard of them etsy leggings raclette kickstarter four dollar toast. 
            Raw denim
        </span>
    </div>`

    function getChatPicture(chatPicture, gender) {
        return chatPicture != null && chatPicture != '' 
            ? `img/${chatPicture}` 
            : `default-img/${gender == 'female' ? 'default-female-icon.png' : 'default-icon.png'}`
    }

    socket.on('channels', data => {
        console.log(data)

        channelsList.innerHTML = ''
        for (let index = 0; index < data.channels.length; index++) {
            const {
                channel_uuid,
                users,
                connectionStatus
            } = data.channels[index]

            const channelItem = parser.parseFromString(channelItemTemplate, 'text/html').body.firstChild
            const otherUsers = users.filter(u => users.length == 1 || u.user_id != data.current_user_id)
            const otherUsernames = `${otherUsers.map(u => u.username).join(', ')}`
            channelItem.querySelector('.title').innerText = otherUsernames
            if(connectionStatus) {
                channelItem.querySelector('.badged-circle').classList.add('online')
            }
            const chatPicture = otherUsers[0].chatPicture, gender = otherUsers[0].sex
            channelItem.querySelector('img.circle').src = getChatPicture(chatPicture, gender)
            channelItem.setAttribute('data-channel_uuid', channel_uuid ? channel_uuid : '')

            channelItem.addEventListener('click', (event) => {
                channelsList.querySelectorAll('li.collection-item').forEach(li => {
                    li.classList.remove('active')
                })
                channelItem.classList.add('active')

                let c_uuid = channelItem.getAttribute('data-channel_uuid')

                c_uuid = c_uuid == '' ? null : c_uuid
                console.log('a click, channel_uuid: ', c_uuid)

                socket.emit('chat', {
                    userIds: users.map(u => u.user_id),
                    channel_uuid: c_uuid,
                })
            })
            channelsList.appendChild(channelItem)
        }
    })

    let prev_user_id = null
    socket.on('chat', data => {
        console.log('chat', data)

        chatWith.innerHTML = `Chat with ${data.users.filter(u => data.users.length == 1 || u.user_id != data.current_user_id).map(u => u.username).join(', ')}`
        chatHistoryList.innerHTML = ''

        msgForm.addEventListener('submit', (event) => {
            event.preventDefault()
            console.log('socket client emit on ', data.channel_uuid, msgInput.value)
            socket.emit('handleMessage', {
                channel_uuid: data.channel_uuid,
                value: msgInput.value,
                userIds: data.users.map(u => u.user_id)
            })
            msgInput.value = ''
        })

        for (let mi = 0; mi < data.messages.length; mi++) {
            const {user_id, username, msg, chatPicture, sex} = data.messages[mi]
            let message = parser.parseFromString(messageTemplate, 'text/html').body.firstChild
            if(user_id == data.current_user_id) {
                message.classList.add('right')
            }
            if(user_id == prev_user_id) {
                message.classList.add('coalesce')
                message.removeChild(message.querySelector('img.circle'))
            }
            else {
                message.querySelector('img.circle').src = getChatPicture(chatPicture, sex)
            }
            prev_user_id = user_id
            message.querySelector('.message').innerText = msg
            
            chatHistoryList.appendChild(message)
        }
    })

    socket.on('messageListener', data => {
        console.log(data)

        const {id, chatPicture, sex} = data.user
        let message = parser.parseFromString(messageTemplate, 'text/html').body.firstChild
        if(id == connectedUserId) {
            message.classList.add('right')
        }
        if(id == prev_user_id) {
            message.classList.add('coalesce')
            message.removeChild(message.querySelector('img.circle'))
        }
        else {
            message.querySelector('img.circle').src = getChatPicture(chatPicture, sex)
        }
        prev_user_id = id
        message.querySelector('.message').innerText = data.msg
        
        chatHistoryList.appendChild(message)
    })
})();