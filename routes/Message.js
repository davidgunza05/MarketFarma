const express = require('express');
const router = express.Router();
const Message = require('../models/Message');

// Rota para obter o histórico de mensagens
router.get('/:userId/:farmaciaId', async (req, res) => {
  const { userId, farmaciaId } = req.params;
  const messages = await Message.find({
    $or: [
      { senderId: userId, receiverId: farmaciaId },
      { senderId: farmaciaId, receiverId: userId }
    ]
  }).sort('timestamp');
  res.json(messages);
});

router.get('/', async (req, res) => { 
    res.render('messages/index', { title: 'Mensagens' });
  });
module.exports = router;
