const express = require('express')
const app = express()
const fs = require('fs')
const sharp = require('sharp')
const http = require('http').createServer(app)
const engine = require('ejs-blocks')
const io = require('socket.io')(http)
const util = require('util')
const compression = require('compression')
const uuidv4 = require('uuid/v4')
const session = require('express-session')
const FileStore = require('session-file-store')(session)
const sharedsession = require("express-socket.io-session")
const bodyParser = require('body-parser')
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const path = require('path')
const {
    body,
    check,
    validationResult
} = require('express-validator')
const knex = require('knex')
const bcrypt = require('bcrypt')
const saltRounds = 10
const sleep = require('./helpers/sleep')
const random = require('./helpers/random')
const auth = require('./helpers/auth')

let db = knex({
    client: 'pg',
    connection: {
        host: '127.0.0.1',
        user: 'postgres',
        password: '123456',
        database: 'chat-app'
    }
})

const sockets = []

app.use(compression())
app.use(express.static(path.join(__dirname, '/public')))

app.set('views', path.join(__dirname, '/views'))
app.engine('ejs', engine);
app.set('view engine', 'ejs');

app.use(bodyParser.json({
    limit: '5mb',
    extended: true
})) // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({ // to support URL-encoded bodies
    extended: true
}))
// add & configure middleware
let _session
app.use(_session = session({
    genid: (req) => {
        return uuidv4() // use UUIDs for session IDs
    },
    store: new FileStore(),
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true
}))
io.use(sharedsession(_session, {
    autoSave: true
}))
// configure passport.js to use the local strategy
passport.use(new LocalStrategy({},
    async (username, password, done) => {
        try{
            // local strategy
            const user = await db.select('*').from('users').where('username', '=', username).first()
    
            if (!user) {
                sleep.sleep(random.int(2, 5))
                return done(null, false, { message: 'Incorrect username.' })
            }
            if (!bcrypt.compareSync(password, user.password)) {
                sleep.sleep(random.int(2, 5))
                return done(null, false, { message: 'Incorrect password.' })
            }
            return done(null, user)
        }
        catch(ex) {
            return done(ex)
        }
    }
))
// tell passport how to serialize the user
passport.serializeUser((user, done) => {
    done(null, {
        id: user.id,
    })
})
passport.deserializeUser(async ({
    id
}, done) => {
    const user = await db.select('*').from('users').where('id', '=', id).first()
    done(null, user)
})

app.use(passport.initialize())
app.use(passport.session())

app.get('/', auth.isAuthorized, (req, res) => {
    res.render('chat', {user: req.user})
})

// create the login get and post routes
app.get('/login', (req, res) => {
    res.render('login', {})
})

app.post('/login', (req, res, next) => {

    passport.authenticate('local', (err, user, info) => {
        if (info) {
            // return res.send(info.message)
            return res.render('login', {msg: info.message})
        }
        if (err) {
            return next(err)
        }
        if (!user) {
            return res.redirect('/login')
        }

        req.login(user, (err) => {
            if (err) {
                return next(err)
            }
            return res.redirect('/')
        })
    })(req, res, next)
})

app.get('/register', (req, res) => {
    res.render('register', {})
})

app.post('/register', [
    // username must be at least 5 chars long and unique
    body('username', 'Username must be at least 5 chars long and unique').isLength({
        min: 5
    }),
    body('username').custom(async value => {
        user = await db.select('username').from('users').where('username', '=', value).first()
        if (user) {
            throw new Error('Username already exists')
        }
        // Indicates the success of this synchronous custom validator
        return true;
    }),
    // username must be an email
    body('email', 'Invalid Email').isEmail(),
    body('email').custom(async value => {
        user = await db.select('email').from('users').where('email', '=', value).first()
        if (user) {
            throw new Error('Email already exists')
        }
        // Indicates the success of this synchronous custom validator
        return true;
    }),
    body('password', 'Password must be at least 5 chars long and unique').isLength({
        min: 5
    }),
    body('password').custom((value, {req}) => {
        if(value != req.body.confirmPassword) {
            throw new Error('Password confirmation does not match password')
        }
        return true
    })
], async (req, res) => {
    // Finds the validation errors in this request and wraps them in an object with handy functions
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.render('register', {errors: errors.mapped(), data: req.body})
    }

    // save user in the database
    let {
        username,
        email,
        password,
        firstName,
        lastName,
        sex
    } = req.body

    // Store hash in DB.
    // Save user
    await db('users').insert({
        username,
        email,
        password: bcrypt.hashSync(password, saltRounds),
        firstName,
        lastName,
        profilePicture: null,
        chatPicture: null,
        sex
    })

    passport.authenticate('local')(req, res, () => {
        res.redirect('/profile')
    })
    // return res.redirect('/login')
})

app.get('/profile', auth.isAuthorized, (req, res) => {
    res.render('profile', { user: req.user });
})

app.post('/profileName', auth.isAuthorized, async (req, res) => {
    const {firstName, lastName} = req.body
    await db('users').update({firstName, lastName}).where({id: req.user.id})
    res.json({firstName, lastName, success: true})
})

app.post('/profileImage', auth.isAuthorized, async (req, res) => {
    const {image, name, type} = req.body
    const imageBase64Data = image.replace(new RegExp(`^data:${type};base64,`), '');

    const imageNamePrefix = uuidv4()
    const imageName = `${imageNamePrefix}.webp`
    const imageUrl = `img/${imageName}`
    // fs.writeFileSync(`public/${imageUrl}`, imageBase64Data, 'base64')
    const info = await sharp(new Buffer(imageBase64Data, 'base64')).webp({ lossless: true }).toFile(`public/${imageUrl}`)
    // create chat img 100x100
    const chatImageName = `${imageNamePrefix}-chat.webp`
    const infoChat = await sharp(`public/${imageUrl}`).resize(100).toFile(`public/img/${chatImageName}`) // resize & save

    await db('users').update({profilePicture: imageName, chatPicture: chatImageName}).where({id: req.user.id})
    // delete old picture if it exists
    if(req.user.profilePicture != null && req.user.profilePicture != '' && fs.existsSync(`public/img/${req.user.profilePicture}`)) {
        fs.unlinkSync(`public/img/${req.user.profilePicture}`)
    }
    if(req.user.chatPicture != null && req.user.chatPicture != '' && fs.existsSync(`public/img/${req.user.chatPicture}`)) {
        fs.unlinkSync(`public/img/${req.user.chatPicture}`)
    }
    res.json({imageUrl, success: true})
})

io.on('connection', async (socket) => {
    sockets.push(socket)
    socket.user_id = socket.handshake.session.passport.user.id
    
    const currentUser = await db.select('id AS user_id', 'username', 'chatPicture', 'sex')
        .from('users').where('id', '=', socket.user_id).first()
    const channels = await getChannels(currentUser)

    socket.emit('channels', channels)

    socket.broadcast.emit('connectionStatusListener', {
        user_id: socket.user_id,
        connected: true
    })

    console.log('a user connected, ' + socket.user_id + ', users: ' + util.inspect(sockets.map(s => s.user_id)))

    socket.on('handleMessage', async (data) => {
        console.log('handleMessage', util.inspect(data))

        // insert message
        const message = await db('messages').insert({
            body: data.value,
            sender_id: socket.handshake.session.passport.user.id,
            channel_uuid: data.channel_uuid
        }).returning(['id','created_at'])
        // insert metadatas
        const users = await db.select('user_id').from('channel_user').where('channel_uuid', '=', data.channel_uuid)
        users.forEach(async ({user_id}) => {
            await db('message_metadatas').insert({
                message_id: message[0].id,
                participant_id: user_id
            })
        })

        const currentUser = await db.select('chatPicture', 'sex')
            .from('users').where('id', '=', socket.user_id).first()

        io.in(data.channel_uuid).emit('messageListener', {
            msg: {
                msg: data.value,
                user_id: socket.user_id,
                chatPicture: currentUser.chatPicture,
                sex: currentUser.sex,
                created_at: message[0].created_at
            },
        });
    })

    socket.on('chat', async (data) => {
        console.log('chat', socket.handshake.session.passport.user.id, util.inspect(data))

        const uuid = await db.select('uuid').from('channels').where('uuid', '=', data.channel_uuid).first()
        
        let channelExist = uuid != null, channel_uuid, messages = [], users

        if (channelExist) {
            channel_uuid = data.channel_uuid
            users = await db.select('u.id AS user_id', 'u.username')
                .from('channel_user AS cu')
                .innerJoin('users AS u', 'u.id', 'cu.user_id')
                .where('cu.channel_uuid', '=', channel_uuid)
        } else {
            // when a channel is created but the other users don't have an updated data in the client side
            if(data.userIds.length == 2) {
                const channelUsers = await db.select(
                        'cu.channel_uuid',
                        db.raw('json_agg(json_build_object(\'user_id\', cu.user_id, \'username\', u.username)) users')
                    )
                    .from('channel_user AS cu')
                    .innerJoin('users AS u', 'u.id', 'cu.user_id')
                    .groupBy('cu.channel_uuid')
                    .havingRaw([...data.userIds.map(id => `${id} = ANY(array_agg(cu.user_id))`), 'COUNT(cu.user_id) = 2'].join(' AND ')).first()
                
                if(channelUsers && channelUsers.users.length == 2) {
                    channelExist = true
                    channel_uuid = data.channel_uuid
                    users = channelUsers.users
                }
            }
        }

        if (channelExist) {
            messages = await db.select('m.body AS msg', 'u.id AS user_id', 'u.chatPicture', 'u.sex', 'm.created_at')
                .from('messages AS m')
                .innerJoin('users AS u', 'u.id', 'm.sender_id')
                .leftJoin('message_metadatas AS mm', 'mm.message_id', 'm.id')
                .where('m.channel_uuid', '=', data.channel_uuid)
                .andWhere('mm.participant_id', '=', socket.handshake.session.passport.user.id)
                .orderBy('m.created_at')
        }

        if (!channelExist) {
            // insert new channel uuid
            const newUuid = uuidv4()
            await db('channels').insert({
                uuid: newUuid,
                one: data.userIds.length == 1
            })
            channel_uuid = newUuid

            // insert new channel_user
            data.userIds.forEach(async user_id => {
                await db('channel_user').insert({
                    channel_uuid,
                    user_id
                })
            })

            users = await db.select('u.id AS user_id', 'u.username')
            .from('channel_user AS cu')
            .innerJoin('users AS u', 'u.id', 'cu.user_id')
            .where('cu.channel_uuid', '=', channel_uuid)
        }

        socket.join(channel_uuid)

        console.log('From: ' + socket.user_id + ', Users joined chat room ' + channel_uuid + ': ');
        io.in(channel_uuid).clients((err, clients) => {
            // clients will be array of socket ids , currently available in given room
            console.log(util.inspect(clients))
        });

        socket.emit('chat', {
            channel_uuid,
            messages,
            users,
            channel_item_id: channelExist ? null : data.channel_uuid
        })
    })

    socket.on('disconnect', async () => {
        let index = sockets.indexOf(socket)
        if (index != -1) {
            sockets.splice(index, 1)
        }

        console.log('user disconnected, ' + socket.user_id + ', users: ' + +util.inspect(sockets.map(s => s.user_id)))
        
        socket.broadcast.emit('connectionStatusListener', {
            user_id: socket.user_id,
            connected: false
        })
    })

})

http.listen(3000, () => {
    console.log('listening on *:3000')
})

async function getChannels(current_user) {

    const definedChannels = await db.raw(
        `SELECT ch_u.channel_uuid, ch_m.body, ch_m.sender_id, ch_m.created_at, ch_u.users
        FROM (
            SELECT cu.channel_uuid,
                json_agg(json_build_object('user_id', cu.user_id, 'username', u.username, 'chatPicture', u."chatPicture", 'sex', u.sex)) users
            FROM channel_user AS cu
            INNER JOIN users AS u ON u.id = cu.user_id
            GROUP BY cu.channel_uuid
            HAVING ${current_user.user_id} = ANY(array_agg(cu.user_id))
        ) AS ch_u
        LEFT JOIN (
            SELECT m1.channel_uuid, m1.body, m1.sender_id, m1.created_at
            FROM messages m1
            INNER JOIN (
                SELECT channel_uuid, MAX(created_at) AS created_at
                FROM messages
                GROUP BY channel_uuid
            ) m2 ON m1.channel_uuid = m2.channel_uuid AND m1.created_at = m2.created_at
        ) ch_m ON ch_m.channel_uuid = ch_u.channel_uuid`
    )

    const users = await db.select('id', 'username', 'chatPicture', 'sex').from('users')

    const channels = []

    // insert defined channels
    for (let i = 0; i < definedChannels.rows.length; i++) {
        const definedChannel = definedChannels.rows[i]
        channels.push({
            channel_uuid: definedChannel.channel_uuid,
            body: definedChannel.body,
            sender_id: definedChannel.sender_id,
            created_at: definedChannel.created_at,
            users: definedChannel.users
        })
    }

    // add other undefined channels, 
    //  which include channels between 2 users that don't exist 
    //  and the channel of connected user if not defined
    for (let i = 0; i < users.length; i++) {
        const user = users[i]
        // we assume `dc.user_ids.includes(current_user_id)` is always true, because of `having` clause
        if (user.id == current_user.user_id) {
            const index = definedChannels.rows.findIndex(dc => dc.users.length == 1)
            if (index == -1) {
                channels.push({
                    channel_uuid: `id_${uuidv4()}`,
                    body: null,
                    sender_id: null,
                    created_at: null,
                    users: [{
                        user_id: user.id,
                        username: user.username,
                        chatPicture: user.chatPicture,
                        sex: user.sex,
                    }]
                })
            }
        } else {
            const index = definedChannels.rows.findIndex(dc => dc.users.length == 2 && dc.users.find(u => u.user_id == user.id))
            if (index == -1) {
                channels.push({
                    channel_uuid: `id_${uuidv4()}`,
                    body: null,
                    sender_id: null,
                    created_at: null,
                    users: [{
                        user_id: user.id,
                        username: user.username,
                        chatPicture: user.chatPicture,
                        sex: user.sex,
                    }, {
                        user_id: current_user.user_id,
                        username: current_user.username,
                        chatPicture: current_user.chatPicture,
                        sex: current_user.sex,
                    }]
                })
            }
        }
    }

    // add connectionStatus property to each channel
    channels.forEach((channel, index) => {
        sockets.forEach(socket => {
            if (channel.users.length == 1) {
                channel.connectionStatus = true
            } else {
                const _index = channel.users.findIndex(user => {
                    return user.user_id == socket.user_id && user.user_id != current_user.user_id
                })
                if (_index > -1) {
                    channel.connectionStatus = true
                }
            }
        })
    })

    return channels
}