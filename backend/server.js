const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const stripe = require('stripe')('sk_test_VOTRE_CLE_STRIPE');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmaster');

// Models
const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: String,
  isPremium: { type: Boolean, default: false },
  stripeCustomerId: String,
  subscriptionEndDate: Date,
  createdAt: { type: Date, default: Date.now }
});

const TaskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title: String,
  description: String,
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  completed: { type: Boolean, default: false },
  dueDate: Date,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Task = mongoose.model('Task', TaskSchema);

// Middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, 'VOTRE_SECRET_JWT');
    req.user = await User.findById(decoded.id);
    next();
  } catch (e) {
    res.status(401).send({ error: 'Unauthorized' });
  }
};

const checkTaskLimit = async (req, res, next) => {
  if (req.user.isPremium) return next();
  const taskCount = await Task.countDocuments({ userId: req.user._id });
  if (taskCount >= 10) {
    return res.status(403).send({ 
      error: 'Task limit reached. Upgrade to Premium for unlimited tasks.',
      upgradeUrl: '/api/create-checkout-session'
    });
  }
  next();
};

// Routes Auth
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword });
    await user.save();
    const token = jwt.sign({ id: user._id }, 'VOTRE_SECRET_JWT');
    res.status(201).send({ token, user: { email: user.email, isPremium: user.isPremium } });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !await bcrypt.compare(password, user.password)) {
      throw new Error('Invalid credentials');
    }
    const token = jwt.sign({ id: user._id }, 'VOTRE_SECRET_JWT');
    res.send({ token, user: { email: user.email, isPremium: user.isPremium } });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

// Routes Tasks
app.get('/api/tasks', auth, async (req, res) => {
  const tasks = await Task.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.send(tasks);
});

app.post('/api/tasks', auth, checkTaskLimit, async (req, res) => {
  const task = new Task({ ...req.body, userId: req.user._id });
  await task.save();
  res.status(201).send(task);
});

app.patch('/api/tasks/:id', auth, async (req, res) => {
  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    req.body,
    { new: true }
  );
  res.send(task);
});

app.delete('/api/tasks/:id', auth, async (req, res) => {
  await Task.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  res.send({ message: 'Task deleted' });
});

// Stripe - Créer session checkout (9.99€/mois)
app.post('/api/create-checkout-session', auth, async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    customer_email: req.user.email,
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: { name: 'TaskMaster Pro Premium' },
        unit_amount: 999,
        recurring: { interval: 'month' }
      },
      quantity: 1,
    }],
    mode: 'subscription',
    success_url: 'https://votre-app.com/success',
    cancel_url: 'https://votre-app.com/cancel',
  });
  res.send({ url: session.url });
});

// Webhook Stripe
app.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], 'VOTRE_WEBHOOK_SECRET');
  
  if (event.type === 'checkout.session.completed') {
    const customer = await User.findOne({ email: event.data.object.customer_email });
    customer.isPremium = true;
    customer.stripeCustomerId = event.data.object.customer;
    customer.subscriptionEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await customer.save();
  }
  
  res.send({ received: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
