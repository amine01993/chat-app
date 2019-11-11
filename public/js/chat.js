(function () {

    const socket = io()
    const uploader = new SocketIOFileClient(socket)

    const parser = new DOMParser()
    const connectedUserId = document.getElementById('connected-user').value
    const uploads = {}
    const unReadMessages = []

    const channelsList = document.getElementById('channels-list')
    const chatCard = document.getElementById('chat-card')
    const chatWith = chatCard.querySelector('.card-title')
    const chatHistoryList = chatCard.querySelector('.chat-wrapper')
    const chatContent = chatCard.querySelector('.chat-content')
    const addGroupContainer = chatCard.querySelector('.add-group-container')
    const addGroupAction = document.getElementById('add-group-action')
    const msgForm = chatCard.querySelector('#message-form')
    const msgSend = chatCard.querySelector('#send-message')
    const msgInput = chatCard.querySelector('#message-input')
    const uploadFile = chatCard.querySelector('#upload-file')
    const uploadFileInput = document.getElementById('upload-file-input')
    const attachmentFiles = chatCard.querySelector('.message-attachments-list')

    const parse = html => parser.parseFromString(html, 'text/html').body.firstChild
    
    const renderChannelItem = ({users, channel_uuid, body, sender_id, connectionStatus, created_at, unread_count}) => {
        const otherUsers = users.filter(u => users.length == 1 || u.user_id != connectedUserId)
        const title = otherUsers.map(u => u.username).join(', ')
        
        let subTitle = '', unReadCount = '', lastMsgDate = '', badgeClass = '', unReadClass = ''
        if(body) {
            if(users.length > 1 && sender_id == connectedUserId) {
                subTitle += 'You: '
            }
            else if(users.length > 2) {
                subTitle += users.find(u => u.user_id == sender_id).username + ': '
            }
            subTitle += body
            lastMsgDate = moment(new Date(created_at)).format('DD/MM/YYYY HH:mm')

            if(unread_count > 0) {
                unReadCount = `<span class="badge unread-count">${unread_count}</span>`
                unReadClass = ' unread'
            }
        }

        if(connectionStatus) {
            badgeClass = ' online'
        }
        if(otherUsers.length > 1) {
            badgeClass += ' group-picture'
        }

        let imgs = ''
        otherUsers.slice(0, 2).forEach(u => {
            const {chatPicture, sex} = u
            imgs += `<img class="circle" alt="avatar" src="${getChatPicture(chatPicture, sex)}">`            
        })
        
        setConnectionStatus(channel_uuid, connectionStatus)

        return `<li class="collection-item avatar">
            <div class="badged-circle${badgeClass}">
                ${imgs}
            </div>
            <div class="title">${title}</div>
            <div class="sub-title${unReadClass}">${subTitle} ${unReadCount}</div>
            <div class="last-msg-date">${lastMsgDate}</div>
        </li>`
    }

    const renderMessage = ({user_id, msg_id, msg, files, chatPicture, sex, created_at}) => {

        let userImage = '', txtMsg = '', fileList = ``
        
        let msgClass = '', txtMsgAttr, fileListAttr
        if(user_id == connectedUserId) {
            msgClass = ' right'
            txtMsgAttr = 'data-position="left"'
            fileListAttr = 'data-position="left"'
        }
        else {
            txtMsgAttr = 'data-position="right"'
            fileListAttr = 'data-position="right"'
        }

        if(user_id == prev_user_id) {
            msgClass += ' coalesce'
        }
        else {
            userImage = `<img class="circle" alt="avatar" src="${getChatPicture(chatPicture, sex)}">`
        }

        if(msg !== '') {
            txtMsg = `<div class="message tooltipped" ${txtMsgAttr}
                            data-tooltip="${moment(new Date(created_at)).format('MMM D, YYYY [at] HH:mm')}">
                ${msg}
            </div>`
        }

        if(files.length > 0) {
            files.forEach(file => {
                if(file) {
                    if(/^image/i.test(file.type)) {
                        const imgElem = `<div class='message'>
                            <img class="download-image" src="${'attachments/' + file.fileName}" alt="${file.originalFileName}">
                        </div>`
                        fileList += imgElem
                    }
                    else {
                        const fileElem = `<div class='message'>
                            <a href="${'attachments/' + file.fileName}" class="download-file" target="_blank">
                                ${file.originalFileName}
                            </a>
                        </div>`
                        fileList += fileElem
                    }
                }
            })

            fileList = `<div class="message-files tooltipped" ${fileListAttr}
                            data-tooltip="${moment(new Date(created_at)).format('MMM D, YYYY [at] HH:mm')}">
                ${fileList}
            </div>`
        }
        
        return `<div class="chat-message${msgClass}" data-msg-id="${msg_id}">
            ${userImage}
            ${txtMsg}
            ${fileList}
        </div>`
    }

    const renderChatDate = dateStr => `<div class="chat-date">${dateStr}</div>`

    const renderAttachmentUpload = fileName => {
        return `<li class="message-attachment-item">
            <i class="material-icons">insert_drive_file</i>
            <div class="message-attachment-filename" title="${fileName}">
                ${fileName}
            </div>
            <div class="progress">
                <div class="determinate" style="width: 0%"></div>
            </div>
        </li>`
    }

    const renderAttachmentImagePreview = ({id, imageUrl, originalFileName}) => {
        return `<li class="message-attachment-item img-attachment" data-id="${id}">
            <div class="message-attachment-preview">
                <a href="javascript:;" class="close-preview">
                    <i class="material-icons">close</i>
                </a>
                <img src="${imageUrl}" alt="${originalFileName}">
            </div>
        </li>`
    }

    const renderAttachmentFilePreview = ({id, originalFileName}) => {
        return `<li class="message-attachment-item file-attachment" data-id="${id}">
            <div class="message-attachment-preview file-preview">
                <div class="blue">
                    <i class="material-icons">insert_drive_file</i>
                </div>
                <div>
                    <h4 class="file-type-preview">${originalFileName.split('.').pop()}</h4>
                    <p class="file-name-preview" title="${originalFileName}">${originalFileName}</p>
                </div>
                <a href="javascript:;" class="close-preview">
                    <i class="material-icons">close</i>
                </a>
            </div>
        </li>`
    }

    const channelsConnectionStatus = [] // {channel_uuid, connected}

    const addGroupAutoComplete = document.querySelectorAll('.add-group-container .chips')
    const addGroupInst = M.Chips.init(addGroupAutoComplete, {
        placeholder: 'Add users to join this conversation',
        autocompleteOptions: {
            data: {}
        }
    })[0]

    function getChatPicture(chatPicture, gender) {
        return chatPicture != null && chatPicture != '' 
            ? `img/${chatPicture}` 
            : `default-img/${gender == 'female' ? 'default-female-icon.png' : 'default-icon.png'}`
    }

    function addMessage({user_id, msg_id, msg, files, chatPicture, sex, created_at}) {

        const dateMoment = moment(new Date(created_at))
        if(prev_day == null || prev_day != dateMoment.format('DDMMYYYY')) {
            prev_day = dateMoment.format('DDMMYYYY')
            const dayDate = parse(renderChatDate(dateMoment.format('DDMMYYYY')))
            chatHistoryList.appendChild(dayDate)
        }

        // txt message 
        const messageElem = parse(renderMessage({user_id, msg_id, msg, files, chatPicture, sex, created_at}))

        M.Tooltip.init(messageElem.querySelector('.message'), {})
        M.Tooltip.init(messageElem.querySelector('.message-files'), {})
        prev_user_id = user_id

        chatHistoryList.appendChild(messageElem)
    }

    function setConnectionStatus(channel_uuid, connected) {
        const ccs = channelsConnectionStatus.find(c => c.channel_uuid == channel_uuid)
        if(ccs) {
            ccs.connected = connected
        }
        else {
            channelsConnectionStatus.push({
                channel_uuid: channel_uuid,
                connected
            })
        }
    }

    function updateConnectionStatus(channel_uuid, lastConnection) {
        if(channelsConnectionStatus.find(c => c.channel_uuid == channel_uuid && c.connected)) {
            chatCard.querySelector('.connection-status').innerHTML = 'Currently Online'
        }
        else {
            if(lastConnection) {
                chatCard.querySelector('.connection-status').innerHTML = `Last Connection at ${moment(new Date(lastConnection)).format('DD/MM/YYYY HH:mm')}`
            }
            else {
                chatCard.querySelector('.connection-status').innerHTML = ''
            }
        }
    }

    function updateAddGroup(acUsers) {
        // clear chips data
        addGroupInst.chipsData = []
        addGroupInst._renderChips()

        addGroupAction.classList.remove('hide')

        ac_users = acUsers.reduce((accumulator, currentValue) => Object.assign(accumulator, {[currentValue.username]: currentValue.id}), {})
        console.log('ac_users', ac_users)
        addGroupInst.autocomplete.updateData(
            acUsers.reduce((accumulator, currentValue) => Object.assign(accumulator, {[currentValue.username]: null}), {})
        )
    }

    function initMessageInput() {
        // Emojis
        emojione.ascii = true

        const combination = new RegExp(emojione.regAscii.source + '|' + emojione.regShortNames.source, 'g')

        function emojify(elArg) {

            function placeCaretAtEnd(el, moveTo) {
                el.focus()
                if (typeof window.getSelection != "undefined" &&
                    typeof document.createRange != "undefined") {
                    const range = document.createRange()
                    range.setStartBefore(moveTo)
                    range.collapse(false)
                    const sel = window.getSelection()
                    sel.removeAllRanges()
                    sel.addRange(range)
                }
            }

            elArg.childNodes.forEach(node => {

                const matches = node.textContent.match(combination)
                let emo = null
                if (matches) {
                    for(let i = 0; i < matches.length; i++) {
                        const match = matches[i]
                        const start = node.textContent.indexOf(match)
                        const end = node.textContent.indexOf(match) + match.length
            
                        const stringToConvert = node.textContent.slice(start, end)
            
                        const temp_container = document.createElement('div')
                        temp_container.innerHTML = emojione.toImage(stringToConvert)
            
                        emo = temp_container.querySelector('.emojione') || temp_container.firstChild
            
                        const beforeText = document.createTextNode(node.textContent.slice(0, start))
                        const afterText = document.createTextNode(node.textContent.slice(end))
            
                        node.parentNode.insertBefore(beforeText, node)
                        node.parentNode.insertBefore(afterText, node.nextSibling)
                        node.parentNode.replaceChild(emo, node)

                        node = afterText
                    }
                    if(emo) {
                        placeCaretAtEnd(elArg, emo.nextSibling)
                    }
                }
            })
        }

        function removeOuterStyle(html) {
            for(const child of html.children) {
                if(!['emojione'].some(c => child.classList.contains(c))) {
                    child.setAttribute('style', '')
                    child.className = ''
                }
                removeOuterStyle(child)
            }
        }

        msgInput.addEventListener('input', () => {
            emojify(msgInput)
            removeOuterStyle(msgInput)
            resizeChatLayout()
        })

        // File attachments upload
        uploadFile.addEventListener('click', event => {
            uploadFileInput.click()
        })

        uploadFileInput.addEventListener('change', event => {
            console.log(uploadFileInput.files)
            if (uploadFileInput.files && uploadFileInput.files.length > 0) {
                console.log('true')
                const uploadIds = uploader.upload(uploadFileInput, {
                    data: { /* Arbitrary data... */ }
                })
                // setTimeout(function() {
                //     uploader.abort(uploadIds[0]);
                //     console.log(uploader.getUploadInfo());
                // }, 1000);            
            }
        })

        uploader.on('start', function(fileInfo) {
            console.log('Start uploading', fileInfo)

            const attachmentUpload = parse(renderAttachmentUpload(fileInfo.name))

            uploads[fileInfo.uploadId] = {
                elem: attachmentUpload,
                temp: true
            }

            attachmentFiles.appendChild(attachmentUpload)
            resizeChatLayout()
        })
        uploader.on('stream', function(fileInfo) {
            console.log('Streaming... sent ' + fileInfo.sent + ' bytes.')
            uploads[fileInfo.uploadId].elem.querySelector('.determinate').style.width = `${fileInfo.sent / fileInfo.size}%`
        })
        uploader.on('complete', function(fileInfo) {
            console.log('Upload Complete', fileInfo)

            uploads[fileInfo.uploadId].elem.querySelector('.determinate').style.width = `100%`
            uploads[fileInfo.name] = uploads[fileInfo.uploadId]
            delete uploads[fileInfo.uploadId]
        })
        uploader.on('error', function(err) {
            console.log('Error!', err)
        })
        uploader.on('abort', function(fileInfo) {
            console.log('Aborted: ', fileInfo)
            delete uploads[fileInfo.uploadId]
        })        
    }

    function resizeChatLayout() {
        chatCard.style.gridTemplateRows = `88px calc(100vh - 88px - 1px - ${msgForm.offsetHeight}px) ${msgForm.offsetHeight}px`
    }

    function scrollToMessage(msgElem) {
        return new Promise((resolve, reject) => {
            if(msgElem) {
                const imgs = chatHistoryList.querySelectorAll('.chat-message img:not([alt="avatar"])')
                let loadedCount = imgs.length
                const load = () => {
                    if(--loadedCount == 0) {
                        msgElem.scrollIntoView(true)
                        resolve()
                    }
                }
                if(loadedCount == 0) {
                    resolve()
                }
                else {
                    for(const img of imgs) {
                        if(img.complete) {
                            load()
                        }
                        else {
                            img.addEventListener('load', () => {
                                load()
                            })
                        }
                    }
                }
            }
            else {
                resolve()
            }
        })
    }

    async function scrollToLastMessage() {
        const lastChatMsg = chatHistoryList.querySelector('.chat-message:last-child') 
        await scrollToMessage(lastChatMsg)
    }

    // check if an unread message has been read
    // if true return message id else false
    function isMessageRead(chatMsgElem) {
        const msg_id = chatMsgElem.dataset.msgId
        const mi = unReadMessages.findIndex(mId => mId == msg_id)
        if(mi == -1) return false

        const msgBound = chatMsgElem.getBoundingClientRect()
        // is in viewport
        if( msgBound.top >= 0 && msgBound.left >= 0 &&
            msgBound.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            msgBound.right <= (window.innerWidth || document.documentElement.clientWidth) ) {
            // if container show the message
            const containerBound = chatContent.getBoundingClientRect()
            if( msgBound.top >= containerBound.top && msgBound.bottom <= containerBound.bottom ) {
                // unReadMessages.splice(mi, 1)
                return msg_id
            }
        }
        return false
    }

    function updateMessageRead() {
        const readMsgs = []
        for(const msgElem of chatHistoryList.querySelectorAll('.chat-message')) {
            const mid = isMessageRead(msgElem)
            if(mid) readMsgs.push(mid)
        }
        
        if(readMsgs.length > 0) {
            socket.emit('updateMessageRead', readMsgs)
        }
    }

    socket.on('channels', channels => {
        console.log(channels)

        channelsList.innerHTML = ''
        for (let index = 0; index < channels.length; index++) {
            const { channel_uuid, users } = channels[index]

            const channelItem = parse(renderChannelItem(channels[index]))

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

        if(selected_channel_uuid) {
            const channelElem = channelsList.querySelector(`[data-channel_uuid='${selected_channel_uuid}']`)
            channelElem.classList.add('active')
        }
    })

    let prev_user_id = null, prev_day = null, ac_users = null, timeOut = null

    chatContent.addEventListener('scroll', event => {
        if(timeOut) clearTimeout(timeOut)
        timeOut = setTimeout(() => {
            updateMessageRead()
        }, 100)
    })
    
    socket.on('chat', async ({channel_uuid, users, messages, channel_item_id, acUsers}) => {
        console.log('chat', {channel_uuid, users, messages, channel_item_id})

        chatWith.innerHTML = `Chat with ${users.filter(u => users.length == 1 || u.user_id != connectedUserId).map(u => u.username).join(', ')}`
        
        const _users = users.filter(u => (users.length == 1 || u.user_id != connectedUserId) && u.lastConnection)
        let lastConnection = null
        if(_users.length > 0) {
            const _user = _users.sort((la, lb) => la.lastConnection <= lb.lastConnection ? 1 : -1)[0]
            lastConnection = _user.lastConnection
        }
        updateConnectionStatus(channel_uuid, lastConnection)

        // update channelItem id
        let channelItem
        if(channel_item_id) {
            channelItem = document.querySelector(`[data-channel_uuid='${channel_item_id}']`)
            channelItem.setAttribute('data-channel_uuid', channel_uuid)
        }
        else {
            channelItem = document.querySelector(`[data-channel_uuid='${channel_uuid}']`)
        }

        const unReadItem = channelItem.querySelector('.sub-title.unread')
        if(unReadItem) {
            unReadItem.classList.remove('unread')
            const unReadBadge = unReadItem.querySelector('.unread-count')
            if(unReadBadge) {
                unReadBadge.remove()
            }
        }

        chatHistoryList.innerHTML = ''

        selected_channel_uuid = channel_uuid
        prev_day = null
        unReadMessages.splice(0)
        for (let mi = 0; mi < messages.length; mi++) {
            addMessage(messages[mi])

            const {msg_id, read_at} = messages[mi]
            if(!read_at) {
                unReadMessages.push(msg_id)
            }
        }

        // update addGroup AutoComplete
        updateAddGroup(acUsers)

        if(chatContent.clientHeight == chatContent.scrollHeight) {
            updateMessageRead()
        }
        
        await scrollToLastMessage()
    })

    socket.on('updatedMessageRead', readMsgs => {
        console.log('readMsgs', readMsgs)
        for(const mid of readMsgs) {
            const mi = unReadMessages.findIndex(mi => mi == mid)
            if(mi !== -1) unReadMessages.splice(mi, 1)
        }
    })

    socket.on('updateAddGroup', (acUsers) => {
        updateAddGroup(acUsers)
    })

    socket.on('uploadComplete', ({id, imageUrl, originalFileName, fileName, type}) => {
        // show preview (images, other files)
        let attachmentPreview
        if(/^image/i.test(type)) {
            attachmentPreview = parse(renderAttachmentImagePreview({id, imageUrl, originalFileName}))
        }
        else {
            attachmentPreview = parse(renderAttachmentFilePreview({id, originalFileName}))
        }

        // replace progress by preview
        attachmentFiles.replaceChild(attachmentPreview, uploads[fileName].elem)
        uploads[fileName] = attachmentPreview
        resizeChatLayout()

        // set remove file event
        attachmentPreview.querySelector('.close-preview').addEventListener('click', event => {
            console.log('close preview', originalFileName)
            attachmentPreview.style.opacity = .75
            socket.emit('deleteAttachment', {id})
        })
    })

    socket.on('deletedAttachment', ({id, name}) => {
        if(uploads.hasOwnProperty(name)) {
            attachmentFiles.removeChild(uploads[name])
            delete uploads[name]
            resizeChatLayout()
        }
    })

    let selected_channel_uuid = null
    msgSend.addEventListener('click', (event) => {
        event.preventDefault()
        console.log('socket client emit on ', selected_channel_uuid, msgInput.innerHTML, uploads)

        let uploadsOver = true, file_ids = []
        for (const [, elem] of Object.entries(uploads)) {
            if (elem.hasOwnProperty('temp')) {
                uploadsOver = false
                break
            }
            else {
                file_ids.push(elem.dataset.id)
            }
        }

        if(selected_channel_uuid && (msgInput.innerHTML.trim() != '' || uploadsOver)) {
            socket.emit('handleMessage', {
                channel_uuid: selected_channel_uuid,
                value: msgInput.innerHTML,
                file_ids: file_ids.length == 0 ? null : file_ids.join(',')
            })
            msgInput.innerHTML = ''
            attachmentFiles.innerHTML = ''
            for (var name in uploads) delete uploads[name]
            resizeChatLayout()
        }
    })

    socket.on('messageListener', data => {
        console.log(data)
        addMessage(data.msg)
        scrollToLastMessage()
    })

    socket.on('connectionStatusListener', ({user_id, connected, lastConnection}) => {
        console.log('connectionStatusListener', user_id)
        // if one user is connected then the channel is online
        Array.from(channelsList.querySelectorAll(`.collection-item`))
        .filter(elem => {
            return elem.getAttribute('data-users').split('-').includes(user_id.toString())
        })
        .map(elem => {
            // console.log(elem)
            const elembc = elem.querySelector('.badged-circle')

            if(connected) {
                elembc.classList.add('online')
            }
            else {
                elembc.classList.remove('online')
            }
            const channel_uuid = elem.getAttribute('data-channel_uuid')
            setConnectionStatus(channel_uuid, connected ? true : false)

            if(selected_channel_uuid == channel_uuid) {
                updateConnectionStatus(channel_uuid, lastConnection)
            }
        })
    })

    addGroupAction.addEventListener('click', event => {
        addGroupContainer.classList.toggle('hide')
    })

    document.getElementById('add-users-btn').addEventListener('click', event => {
        console.log(addGroupInst)
        console.log(addGroupInst.chipsData)
        console.log(selected_channel_uuid)

        if(!selected_channel_uuid)
            return
        
        const users = addGroupInst.chipsData.map(c => ac_users[c.tag])
        console.log(users)
        socket.emit('addUsersToChannel', {
            users,
            channel_uuid: selected_channel_uuid
        })
    })

    initMessageInput()
})()