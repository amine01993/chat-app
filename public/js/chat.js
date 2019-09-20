(function () {

    const socket = io()
    const parser = new DOMParser()
    const connectedUserId = document.getElementById('connected-user').value

    const channelItemTemplate = `<li class="collection-item avatar">
        <div class="badged-circle">
            <img class="circle" alt="avatar">
        </div>
        <div class="title"></div>
        <div class="sub-title"></div>
        <div class="last-msg-date"></div>
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
    
    const chatDateTemplate = `<div class="chat-date">
    </div>`

    function getChatPicture(chatPicture, gender) {
        return chatPicture != null && chatPicture != '' 
            ? `img/${chatPicture}` 
            : `default-img/${gender == 'female' ? 'default-female-icon.png' : 'default-icon.png'}`
    }

    socket.on('channels', channels => {
        console.log(channels)

        channelsList.innerHTML = ''
        for (let index = 0; index < channels.length; index++) {
            const {
                channel_uuid,
                body, sender_id, created_at,
                users,
                connectionStatus
            } = channels[index]

            const channelItem = parser.parseFromString(channelItemTemplate, 'text/html').body.firstChild
            const otherUsers = users.filter(u => users.length == 1 || u.user_id != connectedUserId)
            const otherUsernames = `${otherUsers.map(u => u.username).join(', ')}`
            channelItem.querySelector('.title').innerText = otherUsernames
            if(body) {
                let subtitle = ''
                if(users.length > 1 && sender_id == connectedUserId) {
                    subtitle += 'You: '
                }
                else if(users.length > 2) {
                    subtitle += users.find(u => u.user_id == sender_id).username
                }
                subtitle += body
                channelItem.querySelector('.sub-title').innerText = subtitle
                channelItem.querySelector('.last-msg-date').innerText = moment(new Date(created_at)).format('DD/MM/YYYY HH:mm')
            }
            if(connectionStatus) {
                channelItem.querySelector('.badged-circle').classList.add('online')
            }
            const chatPicture = otherUsers[0].chatPicture, gender = otherUsers[0].sex
            channelItem.querySelector('img.circle').src = getChatPicture(chatPicture, gender)
            channelItem.setAttribute('data-channel_uuid', channel_uuid) // existing or temporary
            channelItem.setAttribute('data-users', users.map(u => u.user_id).join('-'))

            channelItem.addEventListener('click', (event) => {
                channelsList.querySelectorAll('li.collection-item').forEach(li => {
                    li.classList.remove('active')
                })
                channelItem.classList.add('active')

                let c_uuid = channelItem.getAttribute('data-channel_uuid')

                console.log('a click, channel_uuid: ', c_uuid)
                prev_user_id = null
                socket.emit('chat', {
                    userIds: users.map(u => u.user_id),
                    channel_uuid: c_uuid,
                })
            })
            channelsList.appendChild(channelItem)
        }
    })

    let prev_user_id = null, prev_day = null
    socket.on('chat', data => {
        console.log('chat', data)

        chatWith.innerHTML = `Chat with ${data.users.filter(u => data.users.length == 1 || u.user_id != connectedUserId).map(u => u.username).join(', ')}`
        chatHistoryList.innerHTML = ''

        // update channelItem id
        if(data.channel_item_id) {
            const channelItem = document.querySelector(`[data-channel_uuid=${data.channel_item_id}]`)
            channelItem.setAttribute('data-channel_uuid', data.channel_uuid)
        }

        selected_channel_uuid = data.channel_uuid
        
        prev_day = null
        for (let mi = 0; mi < data.messages.length; mi++) {
            const {user_id, msg, chatPicture, sex, created_at} = data.messages[mi]
            const dateMoment = moment(new Date(created_at))
            if(prev_day == null || prev_day != dateMoment.format('DDMMYYYY')) {
                prev_day = dateMoment.format('DDMMYYYY')
                const dayDate = parser.parseFromString(chatDateTemplate, 'text/html').body.firstChild
                dayDate.innerHTML = dateMoment.format('DD/MM/YYYY HH:mm')
                chatHistoryList.appendChild(dayDate)
            }

            const message = parser.parseFromString(messageTemplate, 'text/html').body.firstChild
            
            const textMessage = message.querySelector('.message')
            textMessage.innerText = msg
            textMessage.classList.add('tooltipped')
            textMessage.setAttribute('data-tooltip', moment(new Date(created_at)).format('MMM D, YYYY [at] HH:mm'))

            if(user_id == connectedUserId) {
                message.classList.add('right')
                textMessage.setAttribute('data-position', 'left')
            }
            else {
                textMessage.setAttribute('data-position', 'right')
            }

            M.Tooltip.init(textMessage, {})

            if(user_id == prev_user_id) {
                message.classList.add('coalesce')
                message.removeChild(message.querySelector('img.circle'))
            }
            else {
                message.querySelector('img.circle').src = getChatPicture(chatPicture, sex)
            }
            prev_user_id = user_id
            
            chatHistoryList.appendChild(message)
        }
    })

    let selected_channel_uuid = null
    msgForm.addEventListener('submit', (event) => {
        event.preventDefault()
        console.log('socket client emit on ', selected_channel_uuid, msgInput.value)

        if(selected_channel_uuid && msgInput.value.trim() != '') {
            socket.emit('handleMessage', {
                channel_uuid: selected_channel_uuid,
                value: msgInput.value,
            })
            msgInput.value = ''
        }
    })

    socket.on('messageListener', data => {
        console.log(data)

        const {user_id, msg, chatPicture, sex, created_at} = data.msg
        const dateMoment = moment(new Date(created_at))
        if(prev_day == null || prev_day != dateMoment.format('DDMMYYYY')) {
            prev_day = dateMoment.format('DDMMYYYY')
            const dayDate = parser.parseFromString(chatDateTemplate, 'text/html').body.firstChild
            dayDate.innerHTML = dateMoment.format('DD/MM/YYYY HH:mm')
            chatHistoryList.appendChild(dayDate)
        }

        const message = parser.parseFromString(messageTemplate, 'text/html').body.firstChild
        const textMessage = message.querySelector('.message')
        textMessage.innerText = msg
        textMessage.classList.add('tooltipped')
        textMessage.setAttribute('data-tooltip', moment(new Date(created_at)).format('MMM D, YYYY [at] HH:mm'))

        if(user_id == connectedUserId) {
            message.classList.add('right')
            textMessage.setAttribute('data-position', 'left')
        }
        else {
            textMessage.setAttribute('data-position', 'right')
        }

        M.Tooltip.init(textMessage, {})

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
    })

    socket.on('connectionStatusListener', ({user_id, connected}) => {
        console.log('connectionStatusListener', user_id)
        Array.from(channelsList.querySelectorAll(`.collection-item`))
        .filter(elem => {
            return elem.getAttribute('data-users').split('-').includes(user_id.toString())
        })
        .map(elem => {
            console.log(elem)
            const elembc = elem.querySelector('.badged-circle')
            if(connected) {
                if(!elembc.classList.contains('online')) {
                    elembc.classList.add('online')
                }
            }
            else {
                if(elembc.classList.contains('online')) {
                    elembc.classList.remove('online')
                }
            }
        })
    })
})();