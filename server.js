// VIDYASHETU BACKEND SERVER
// Render pe deploy karna hai

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log('MongoDB Error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  uniqueId: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher', 'parent', 'institute', 'government', 'admin'], required: true },
  className: String,
  rollNumber: String,
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  instituteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  subjects: [String],
  assignedClasses: [String],
  children: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  monitoringEnabled: { type: Boolean, default: true },
  instituteName: String,
  instituteCode: String,
  address: String,
  district: String,
  state: String,
  jurisdiction: String,
  accessLevel: { type: String, enum: ['district', 'state', 'national'] },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

const User = mongoose.model('User', userSchema);

// Notice Schema
const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  category: { type: String, enum: ['general', 'urgent', 'exam', 'result', 'event', 'holiday', 'fee', 'timetable'] },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  instituteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  targetRoles: [String],
  targetClasses: [String],
  isPinned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Notice = mongoose.model('Notice', noticeSchema);

// Attendance Schema
const attendanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  instituteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  className: String,
  date: { type: Date, default: Date.now },
  entryTime: Date,
  exitTime: Date,
  duration: Number,
  status: { type: String, enum: ['present', 'absent', 'late'], default: 'present' },
  method: { type: String, enum: ['biometric', 'manual', 'camera'], default: 'manual' }
});

const Attendance = mongoose.model('Attendance', attendanceSchema);

// Test Schema
const testSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subject: String,
  className: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  instituteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  questions: [{
    question: String,
    options: [String],
    correctAnswer: Number,
    marks: { type: Number, default: 1 }
  }],
  duration: Number,
  totalMarks: Number,
  isActive: { type: Boolean, default: false }
});

const Test = mongoose.model('Test', testSchema);

// Test Result Schema
const testResultSchema = new mongoose.Schema({
  testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test' },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  answers: [{
    questionIndex: Number,
    selectedOption: Number,
    isCorrect: Boolean
  }],
  score: Number,
  totalMarks: Number,
  percentage: Number,
  rank: Number,
  submittedAt: { type: Date, default: Date.now }
});

const TestResult = mongoose.model('TestResult', testResultSchema);

// Doubt Schema
const doubtSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  className: String,
  subject: String,
  question: { type: String, required: true },
  status: { type: String, enum: ['pending', 'teacher_answered', 'ai_answered'], default: 'pending' },
  teacherAnswer: String,
  aiAnswer: String,
  answeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  answeredAt: Date,
  createdAt: { type: Date, default: Date.now }
});

const Doubt = mongoose.model('Doubt', doubtSchema);

// Chat History Schema
const chatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  role: { type: String, enum: ['user', 'ai'] },
  message: String,
  timestamp: { type: Date, default: Date.now }
});

const ChatHistory = mongoose.model('ChatHistory', chatSchema);

// Content Schema
const contentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  type: { type: String, enum: ['video', 'pdf', 'ppt', 'notes'] },
  subject: String,
  className: String,
  chapter: String,
  url: String,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  instituteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

const Content = mongoose.model('Content', contentSchema);

// Auth Middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error('No token');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'vidyashetu_secret');
    req.user = await User.findById(decoded.userId);
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Please authenticate' });
  }
};

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, phone, password, role, ...extra } = req.body;
    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email or phone already exists' });
    }
    const prefix = role === 'student' ? 'VS-S' : role === 'teacher' ? 'VS-T' : 'VS';
    const random = Math.floor(10000 + Math.random() * 90000);
    const uniqueId = `${prefix}-2026-${random}`;

    const user = new User({ uniqueId, fullName, email, phone, password, role, ...extra });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'vidyashetu_secret', { expiresIn: '30d' });

    res.status(201).json({
      success: true,
      token,
      user: { uniqueId: user.uniqueId, fullName: user.fullName, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'vidyashetu_secret', { expiresIn: '30d' });

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        uniqueId: user.uniqueId,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        className: user.className,
        subjects: user.subjects,
        instituteName: user.instituteName,
        children: user.children,
        monitoringEnabled: user.monitoringEnabled
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get Profile
app.get('/api/auth/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get all users
app.get('/api/users', auth, async (req, res) => {
  try {
    const { role, instituteId, className } = req.query;
    let query = {};
    if (role) query.role = role;
    if (instituteId) query.instituteId = instituteId;
    if (className) query.className = className;

    if (req.user.role === 'government') {
      query.district = req.user.jurisdiction;
    } else if (req.user.role === 'institute') {
      query.$or = [{ instituteId: req.user._id }, { _id: req.user._id }];
    } else if (req.user.role === 'teacher') {
      query.className = { $in: req.user.assignedClasses };
    } else if (req.user.role === 'parent') {
      query._id = { $in: req.user.children };
    }

    const users = await User.find(query).select('-password');
    res.json({ success: true, users });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Notices
app.post('/api/notices', auth, async (req, res) => {
  try {
    if (!['institute', 'admin', 'government'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const { title, content, category, targetRoles, targetClasses } = req.body;
    const notice = new Notice({
      title, content, category: category || 'general',
      publishedBy: req.user._id,
      instituteId: req.user.role === 'institute' ? req.user._id : req.body.instituteId,
      targetRoles: targetRoles || ['student', 'teacher', 'parent'],
      targetClasses: targetClasses || []
    });
    await notice.save();
    res.status(201).json({ success: true, notice });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get('/api/notices', auth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'student') {
      query.targetRoles = 'student';
      query.$or = [{ targetClasses: req.user.className }, { targetClasses: { $size: 0 } }];
    } else if (req.user.role === 'teacher') {
      query.targetRoles = 'teacher';
    } else if (req.user.role === 'parent') {
      query.targetRoles = 'parent';
    } else if (req.user.role === 'institute') {
      query.instituteId = req.user._id;
    }
    const notices = await Notice.find(query).populate('publishedBy', 'fullName role').sort({ isPinned: -1, createdAt: -1 });
    res.json({ success: true, notices });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Attendance
app.post('/api/attendance', auth, async (req, res) => {
  try {
    const { userId, className, status, method } = req.body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existing = await Attendance.findOne({ userId: userId || req.user._id, date: today, status: 'present' });
    if (existing && !req.body.exitTime) {
      return res.json({ success: true, message: 'Already marked present', attendance: existing });
    }
    if (req.body.exitTime && existing) {
      existing.exitTime = new Date();
      existing.duration = Math.floor((existing.exitTime - existing.entryTime) / 60000);
      await existing.save();
      return res.json({ success: true, attendance: existing });
    }
    const attendance = new Attendance({
      userId: userId || req.user._id,
      instituteId: req.user.instituteId,
      className: className || req.user.className,
      entryTime: new Date(),
      status: status || 'present',
      method: method || 'manual'
    });
    await attendance.save();
    res.json({ success: true, attendance });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get('/api/attendance', auth, async (req, res) => {
  try {
    const { userId, className, date } = req.query;
    let query = {};
    if (userId) query.userId = userId;
    if (className) query.className = className;
    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      query.date = { $gte: d, $lt: new Date(d.getTime() + 86400000) };
    }
    if (req.user.role === 'parent' && !userId) {
      query.userId = { $in: req.user.children };
    }
    const attendance = await Attendance.find(query).populate('userId', 'fullName uniqueId className').sort({ date: -1, entryTime: -1 });
    res.json({ success: true, attendance });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Tests
app.post('/api/tests', auth, async (req, res) => {
  try {
    if (!['teacher', 'institute', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const { title, subject, className, questions, duration } = req.body;
    const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
    const test = new Test({
      title, subject, className,
      createdBy: req.user._id,
      instituteId: req.user.instituteId || req.user._id,
      questions, duration: duration || 30, totalMarks,
      isActive: true
    });
    await test.save();
    res.status(201).json({ success: true, test });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get('/api/tests', auth, async (req, res) => {
  try {
    const { className, subject } = req.query;
    let query = { isActive: true };
    if (className) query.className = className;
    if (subject) query.subject = subject;
    if (req.user.role === 'student') {
      query.className = req.user.className;
    }
    const tests = await Test.find(query).populate('createdBy', 'fullName');
    res.json({ success: true, tests });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.post('/api/tests/:testId/submit', auth, async (req, res) => {
  try {
    const { answers } = req.body;
    const test = await Test.findById(req.params.testId);
    if (!test) return res.status(404).json({ success: false, message: 'Test not found' });
    let score = 0;
    const processedAnswers = answers.map((ans, idx) => {
      const question = test.questions[idx];
      const isCorrect = ans.selectedOption === question.correctAnswer;
      if (isCorrect) score += question.marks;
      return { questionIndex: idx, selectedOption: ans.selectedOption, isCorrect };
    });
    const percentage = (score / test.totalMarks) * 100;
    const allResults = await TestResult.find({ testId: test._id }).sort({ score: -1 });
    const rank = allResults.filter(r => r.score > score).length + 1;
    const result = new TestResult({
      testId: test._id, studentId: req.user._id,
      answers: processedAnswers, score, totalMarks: test.totalMarks, percentage, rank
    });
    await result.save();
    res.json({ success: true, result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get('/api/tests/results', auth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'student') {
      query.studentId = req.user._id;
    } else if (req.user.role === 'parent') {
      query.studentId = { $in: req.user.children };
    } else if (req.user.role === 'teacher') {
      const tests = await Test.find({ createdBy: req.user._id });
      query.testId = { $in: tests.map(t => t._id) };
    }
    const results = await TestResult.find(query)
      .populate('testId', 'title subject totalMarks')
      .populate('studentId', 'fullName uniqueId className')
      .sort({ submittedAt: -1 });
    res.json({ success: true, results });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Doubts
app.post('/api/doubts', auth, async (req, res) => {
  try {
    const { className, subject, question } = req.body;
    const doubt = new Doubt({
      studentId: req.user._id,
      className: className || req.user.className,
      subject, question
    });
    await doubt.save();
    setTimeout(async () => {
      const d = await Doubt.findById(doubt._id);
      if (d && d.status === 'pending') {
        d.aiAnswer = `Is sawal ka jawab abhi available nahi hai. Teacher jaldi answer karega. Aap ${subject} ke notes refer karein.`;
        d.status = 'ai_answered';
        await d.save();
      }
    }, 5 * 60 * 1000);
    res.status(201).json({ success: true, doubt });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get('/api/doubts', auth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'student') {
      query.studentId = req.user._id;
    } else if (req.user.role === 'teacher') {
      query.className = { $in: req.user.assignedClasses };
      query.status = 'pending';
    } else if (req.user.role === 'parent') {
      query.studentId = { $in: req.user.children };
    }
    const doubts = await Doubt.find(query)
      .populate('studentId', 'fullName uniqueId')
      .populate('answeredBy', 'fullName')
      .sort({ createdAt: -1 });
    res.json({ success: true, doubts });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.post('/api/doubts/:doubtId/answer', auth, async (req, res) => {
  try {
    if (!['teacher', 'institute', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const { answer } = req.body;
    const doubt = await Doubt.findById(req.params.doubtId);
    if (!doubt) return res.status(404).json({ success: false, message: 'Doubt not found' });
    doubt.teacherAnswer = answer;
    doubt.status = 'teacher_answered';
    doubt.answeredBy = req.user._id;
    doubt.answeredAt = new Date();
    await doubt.save();
    res.json({ success: true, doubt });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// AI Chat
app.post('/api/ai/chat', auth, async (req, res) => {
  try {
    const { message } = req.body;
    await ChatHistory.create({ userId: req.user._id, role: 'user', message });
    const responses = [
      "Bahut accha sawal! 📚 Is topic ko detail mein samajhte hain...",
      "Main aapki madad karunga! 💡 Step-by-step samajhate hain...",
      "Bilkul! 🎯 Yeh important concept hai...",
      "Great question! ✨ Chaliye isko example ke saath samajhte hain..."
    ];
    const aiResponse = `${responses[Math.floor(Math.random() * responses.length)]}\n\n"${message}" ke baare mein main yeh kehna chahunga ki aap is topic ke liye uploaded content refer karein. Agar aapko specific doubt hai toh Doubt Section mein puchein, teacher jaldi answer karega.`;
    await ChatHistory.create({ userId: req.user._id, role: 'ai', message: aiResponse });
    res.json({ success: true, reply: aiResponse });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/ai/history', auth, async (req, res) => {
  try {
    const history = await ChatHistory.find({ userId: req.user._id }).sort({ timestamp: 1 }).limit(50);
    res.json({ success: true, history });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Content
app.post('/api/content', auth, async (req, res) => {
  try {
    if (!['teacher', 'institute', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const content = new Content({ ...req.body, uploadedBy: req.user._id, instituteId: req.user.instituteId || req.user._id });
    await content.save();
    res.status(201).json({ success: true, content });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get('/api/content', auth, async (req, res) => {
  try {
    const { subject, className, type } = req.query;
    let query = {};
    if (subject) query.subject = subject;
    if (className) query.className = className;
    if (type) query.type = type;
    if (req.user.role === 'student') {
      query.className = req.user.className;
    }
    const contents = await Content.find(query).populate('uploadedBy', 'fullName').sort({ createdAt: -1 });
    res.json({ success: true, contents });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Analytics
app.get('/api/analytics', auth, async (req, res) => {
  try {
    const { instituteId, className } = req.query;
    const totalStudents = await User.countDocuments({ role: 'student', instituteId });
    const totalTeachers = await User.countDocuments({ role: 'teacher', instituteId });
    const totalTests = await Test.countDocuments({ instituteId });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const presentToday = await Attendance.countDocuments({ instituteId, date: { $gte: today }, status: 'present' });
    const avgAttendance = totalStudents > 0 ? (presentToday / totalStudents) * 100 : 0;
    const recentResults = await TestResult.find({}).populate('testId', 'title').sort({ submittedAt: -1 }).limit(10);
    res.json({
      success: true,
      analytics: { totalStudents, totalTeachers, totalTests, presentToday, avgAttendance: Math.round(avgAttendance), recentResults }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Vidyashetu Server running on port ${PORT}`);
});
