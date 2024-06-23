const mongoose = require('mongoose')

const NotificationSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now(),
    },
    isRead: {
        type: Boolean,
        default: false,
    }
})
const Notification = mongoose.model('Notification', NotificationSchema)
module.exports = Notification