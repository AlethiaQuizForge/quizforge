'use client';

import React, { useState, useRef, useEffect } from 'react';
import * as mammoth from 'mammoth';

// Storage helper (replaces artifact's storage)
const storage = {
  async get(key) {
    if (typeof window === 'undefined') return null;
    try {
      const value = localStorage.getItem(key);
      return value ? { key, value } : null;
    } catch (e) {
      console.error('Storage get error:', e);
      return null;
    }
  },
  async set(key, value) {
    if (typeof window === 'undefined') return null;
    try {
      localStorage.setItem(key, value);
      return { key, value };
    } catch (e) {
      console.error('Storage set error:', e);
      return null;
    }
  },
  async delete(key) {
    if (typeof window === 'undefined') return null;
    try {
      localStorage.removeItem(key);
      return { key, deleted: true };
    } catch (e) {
      console.error('Storage delete error:', e);
      return null;
    }
  }
};

export default function QuizForge() {
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [authForm, setAuthForm] = useState({ name: '', email: '', role: 'student' });
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const [page, setPage] = useState('landing');
  const [userType, setUserType] = useState(null);
  const [userName, setUserName] = useState('');
  
  const [questionBank, setQuestionBank] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [studentProgress, setStudentProgress] = useState({
    quizzesTaken: 0, totalScore: 0, totalQuestions: 0, topicHistory: {}, recentScores: []
  });
  
  const [classes, setClasses] = useState([]);
  const [currentClass, setCurrentClass] = useState(null);
  const [joinedClasses, setJoinedClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  
  const [quizContent, setQuizContent] = useState('');
  const [quizSubject, setQuizSubject] = useState('');
  const [quizNameInput, setQuizNameInput] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
  const [difficulty, setDifficulty] = useState('mixed');
  
  const [generation, setGeneration] = useState({ isGenerating: false, step: '', progress: 0, error: null });
  const [currentQuiz, setCurrentQuiz] = useState({ id: null, name: '', questions: [], published: false });
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [quizState, setQuizState] = useState({
    currentQuestion: 0, selectedAnswer: null, answeredQuestions: new Set(), score: 0, results: []
  });
  
  const [modal, setModal] = useState(null);
  const [modalInput, setModalInput] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [toast, setToast] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({ active: false, step: '', progress: 0 });
  const [uploadController, setUploadController] = useState(null);
  const fileInputRef = useRef(null);
  
  const cancelUpload = () => {
    if (uploadController) {
      uploadController.abort();
    }
    setUploadProgress({ active: false, step: '', progress: 0 });
    showToast('Upload cancelled', 'info');
  };
  
  // Load user from storage on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const result = await storage.get('quizforge-user');
        if (result && result.value) {
          const userData = JSON.parse(result.value);
          setUser(userData);
          setUserName(userData.name);
          setUserType(userData.role);
          setIsLoggedIn(true);
          
          // Load user's data
          const dataResult = await storage.get(`quizforge-data-${userData.email}`);
          if (dataResult && dataResult.value) {
            const data = JSON.parse(dataResult.value);
            setQuizzes(data.quizzes || []);
            setClasses(data.classes || []);
            setJoinedClasses(data.joinedClasses || []);
            setAssignments(data.assignments || []);
            setSubmissions(data.submissions || []);
            setQuestionBank(data.questionBank || []);
            setStudentProgress(data.studentProgress || { quizzesTaken: 0, totalScore: 0, totalQuestions: 0, topicHistory: {}, recentScores: [] });
          }
        }
      } catch (err) {
        console.log('No saved user found');
      }
      setIsLoading(false);
    };
    loadUser();
  }, []);
  
  // Save data whenever it changes
  useEffect(() => {
    const saveData = async () => {
      if (user && isLoggedIn) {
        try {
          await storage.set(`quizforge-data-${user.email}`, JSON.stringify({
            quizzes, classes, joinedClasses, assignments, submissions, questionBank, studentProgress
          }));
        } catch (err) {
          console.log('Could not save data');
        }
      }
    };
    if (!isLoading && isLoggedIn) {
      saveData();
    }
  }, [quizzes, classes, joinedClasses, assignments, submissions, questionBank, studentProgress, user, isLoggedIn, isLoading]);
  
  const handleLogin = async () => {
    setAuthError('');
    if (!authForm.email.trim()) {
      setAuthError('Please enter your email');
      return;
    }
    
    try {
      // Check if user exists
      const result = await storage.get(`quizforge-account-${authForm.email.toLowerCase()}`);
      if (result && result.value) {
        const userData = JSON.parse(result.value);
        setUser(userData);
        setUserName(userData.name);
        setUserType(userData.role);
        setIsLoggedIn(true);
        await storage.set('quizforge-user', JSON.stringify(userData));
        
        // Load user's data
        const dataResult = await storage.get(`quizforge-data-${userData.email}`);
        if (dataResult && dataResult.value) {
          const data = JSON.parse(dataResult.value);
          setQuizzes(data.quizzes || []);
          setClasses(data.classes || []);
          setJoinedClasses(data.joinedClasses || []);
          setAssignments(data.assignments || []);
          setSubmissions(data.submissions || []);
          setQuestionBank(data.questionBank || []);
          setStudentProgress(data.studentProgress || { quizzesTaken: 0, totalScore: 0, totalQuestions: 0, topicHistory: {}, recentScores: [] });
        }
        
        showToast(`Welcome back, ${userData.name}!`, 'success');
        setPage(userData.role === 'teacher' ? 'teacher-dashboard' : userData.role === 'student' ? 'student-dashboard' : 'creator-dashboard');
      } else {
        setAuthError('Account not found. Please sign up first.');
      }
    } catch (err) {
      setAuthError('Login failed. Please try again.');
    }
  };
  
  const handleSignup = async () => {
    setAuthError('');
    if (!authForm.name.trim()) {
      setAuthError('Please enter your name');
      return;
    }
    if (!authForm.email.trim()) {
      setAuthError('Please enter your email');
      return;
    }
    if (!authForm.email.includes('@')) {
      setAuthError('Please enter a valid email');
      return;
    }
    
    try {
      // Check if user already exists
      const existing = await storage.get(`quizforge-account-${authForm.email.toLowerCase()}`);
      if (existing && existing.value) {
        setAuthError('An account with this email already exists. Please log in.');
        return;
      }
      
      const userData = {
        id: `user_${Date.now()}`,
        name: authForm.name.trim(),
        email: authForm.email.toLowerCase().trim(),
        role: authForm.role,
        createdAt: Date.now()
      };
      
      await storage.set(`quizforge-account-${userData.email}`, JSON.stringify(userData));
      await storage.set('quizforge-user', JSON.stringify(userData));
      
      setUser(userData);
      setUserName(userData.name);
      setUserType(userData.role);
      setIsLoggedIn(true);
      
      showToast(`Welcome to QuizForge, ${userData.name}!`, 'success');
      setPage(userData.role === 'teacher' ? 'teacher-dashboard' : userData.role === 'student' ? 'student-dashboard' : 'creator-dashboard');
    } catch (err) {
      setAuthError('Signup failed. Please try again.');
    }
  };
  
  const handleLogout = async () => {
    try {
      await storage.delete('quizforge-user');
    } catch (err) {
      console.log('Could not clear session');
    }
    setUser(null);
    setIsLoggedIn(false);
    setUserType(null);
    setUserName('');
    setQuizzes([]);
    setClasses([]);
    setJoinedClasses([]);
    setAssignments([]);
    setSubmissions([]);
    setQuestionBank([]);
    setStudentProgress({ quizzesTaken: 0, totalScore: 0, totalQuestions: 0, topicHistory: {}, recentScores: [] });
    setAuthForm({ name: '', email: '', role: 'student' });
    setPage('landing');
    showToast('Logged out successfully', 'info');
  };
  
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const navigate = (newPage, type = null) => {
    setPage(newPage);
    if (type) setUserType(type);
  };
  
  // Helper to get correct dashboard for current user
  const getDashboard = () => {
    if (userType === 'teacher') return 'teacher-dashboard';
    if (userType === 'student') return 'student-dashboard';
    return 'creator-dashboard';
  };

  const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const generateClassCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  // Load PDF.js dynamically
  const loadPdfJs = () => {
    return new Promise((resolve, reject) => {
      if (window.pdfjsLib) {
        resolve(window.pdfjsLib);
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const fileName = file.name.toLowerCase();
    
    // Text files
    if (file.type === 'text/plain' || fileName.endsWith('.txt')) {
      const text = await file.text();
      setQuizContent(text);
      showToast('✅ File loaded', 'success');
    } 
    // Word documents (.docx)
    else if (fileName.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      setUploadProgress({ active: true, step: 'Reading Word document...', progress: 30 });
      try {
        const arrayBuffer = await file.arrayBuffer();
        setUploadProgress({ active: true, step: 'Extracting text...', progress: 60 });
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value.trim();
        
        if (text.length > 100) {
          setQuizContent(text);
          setUploadProgress({ active: true, step: 'Complete!', progress: 100 });
          setTimeout(() => setUploadProgress({ active: false, step: '', progress: 0 }), 500);
          showToast(`✅ Extracted ${text.length.toLocaleString()} characters`, 'success');
        } else {
          setUploadProgress({ active: false, step: '', progress: 0 });
          showToast('⚠️ Document has little text content', 'error');
        }
      } catch (err) {
        console.error('Word doc error:', err);
        setUploadProgress({ active: false, step: '', progress: 0 });
        showToast('⚠️ Error reading Word document. Try copy-pasting content.', 'error');
      }
    }
    // PDF files - try text extraction first, then vision API
    else if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
      setUploadProgress({ active: true, step: 'Loading PDF reader...', progress: 5 });
      
      try {
        const pdfjsLib = await loadPdfJs();
        setUploadProgress({ active: true, step: 'Opening PDF...', progress: 10 });
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = Math.min(pdf.numPages, 20);
        
        // FIRST: Try to extract text directly using PDF.js
        setUploadProgress({ active: true, step: 'Extracting text from PDF...', progress: 20 });
        
        let extractedText = '';
        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          extractedText += pageText + '\n\n';
          
          const progress = 20 + Math.round((i / numPages) * 60);
          setUploadProgress({ active: true, step: `Reading page ${i}/${numPages}...`, progress });
        }
        
        extractedText = extractedText.trim();
        
        // If we got good text, use it
        if (extractedText.length > 500) {
          setQuizContent(extractedText);
          setUploadProgress({ active: true, step: '✅ Complete!', progress: 100 });
          setTimeout(() => setUploadProgress({ active: false, step: '', progress: 0 }), 500);
          showToast(`✅ Extracted ${extractedText.length.toLocaleString()} characters from ${numPages} pages`, 'success');
        } 
        // If little text found, try Vision API for image-based PDFs
        else {
          setUploadProgress({ active: true, step: 'PDF appears to be image-based. Using AI vision...', progress: 70 });
          
          // Convert pages to images
          const pageImages = [];
          const maxVisionPages = Math.min(numPages, 10); // Limit for vision
          
          for (let i = 1; i <= maxVisionPages; i++) {
            const page = await pdf.getPage(i);
            const scale = 1.2;
            const viewport = page.getViewport({ scale });
            
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            
            await page.render({ canvasContext: ctx, viewport }).promise;
            const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
            pageImages.push(base64);
          }
          
          setUploadProgress({ active: true, step: '🧠 AI analyzing images... (30-60 seconds)', progress: 80 });
          
          const controller = new AbortController();
          setUploadController(controller);
          
          const imageContent = pageImages.map(img => ({
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: img }
          }));
          
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 8000,
              messages: [{
                role: 'user',
                content: [
                  ...imageContent,
                  { type: 'text', text: 'Extract ALL text and describe all visual content (graphs, charts, diagrams) from these PDF pages. Output as clean text.' }
                ]
              }]
            })
          });
          
          setUploadController(null);
          
          if (!response.ok) {
            throw new Error(`API error: ${response.status}. Try copying text directly from the PDF.`);
          }
          
          setUploadProgress({ active: true, step: 'Processing response...', progress: 95 });
          
          const data = await response.json();
          const visionText = data.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('\n\n');
          
          if (visionText.length > 200) {
            setQuizContent(visionText);
            setUploadProgress({ active: true, step: '✅ Complete!', progress: 100 });
            setTimeout(() => setUploadProgress({ active: false, step: '', progress: 0 }), 500);
            showToast(`✅ Extracted content from ${maxVisionPages} pages!`, 'success');
          } else {
            throw new Error('Could not extract content. Please copy-paste text from PDF.');
          }
        }
      } catch (err) {
        console.error('PDF error:', err);
        setUploadProgress({ active: false, step: '', progress: 0 });
        setUploadController(null);
        
        if (err.name === 'AbortError') {
          showToast('Upload cancelled', 'info');
        } else {
          showToast('⚠️ ' + err.message, 'error');
        }
      }
    } 
    else {
      showToast('⚠️ Please use .docx, .pdf, or .txt files', 'error');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const generateQuestions = async () => {
    setPage('generating');
    setGeneration({ isGenerating: true, step: 'Analyzing your content...', progress: 5, error: null });

    // Animated progress simulation while API works
    let currentProgress = 5;
    const progressInterval = setInterval(() => {
      currentProgress += Math.random() * 3;
      if (currentProgress > 85) currentProgress = 85; // Cap at 85% until actually done
      setGeneration(g => ({ ...g, progress: Math.round(currentProgress) }));
    }, 500);

    try {
      const difficultyInstructions = {
        'basic': 'All questions should be BASIC level.',
        'mixed': 'Create a MIX: 30% BASIC, 50% INTERMEDIATE, 20% ADVANCED.',
        'advanced': 'All questions should be ADVANCED.'
      };

      setGeneration(g => ({ ...g, step: 'Building quiz prompt...', progress: 10 }));

      const prompt = `You are an expert educational assessment designer.

## INSTRUCTIONS:
1. Test understanding, not just recall.
2. Create plausible distractors.
3. Write helpful explanations.

## DIFFICULTY: ${difficultyInstructions[difficulty]}
## SUBJECT: ${quizSubject || 'Determine from content'}

Return ONLY a valid JSON array with exactly ${numQuestions} questions:
[{"id":1,"question":"...","topic":"...","difficulty":"Basic|Intermediate|Advanced","options":[{"text":"...","isCorrect":false},{"text":"...","isCorrect":true},{"text":"...","isCorrect":false},{"text":"...","isCorrect":false}],"explanation":"..."}]

## SOURCE MATERIAL:
${quizContent.substring(0, 40000)}

## GENERATE ${numQuestions} QUESTIONS (JSON only):`;

      setGeneration(g => ({ ...g, step: `Generating ${numQuestions} questions with AI... (typically 30-90 seconds)`, progress: 15 }));
      currentProgress = 15;

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: quizContent,
          subject: quizSubject,
          numQuestions,
          difficulty
        })
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      setGeneration(g => ({ ...g, step: 'Processing AI response...', progress: 90 }));
      
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setGeneration(g => ({ ...g, step: 'Formatting questions...', progress: 95 }));
      
      let questions = data.questions;
      questions = questions.map((q, idx) => ({ ...q, id: idx + 1, options: shuffleArray([...q.options]) }));

      setGeneration({ isGenerating: false, step: 'Complete!', progress: 100, error: null });
      setCurrentQuiz({
        id: `quiz_${Date.now()}`,
        name: quizNameInput || 'Generated Quiz',
        questions: shuffleArray(questions),
        published: false,
        createdAt: Date.now()
      });

      showToast(`✅ Generated ${questions.length} questions!`, 'success');
      
      if (userType === 'student') {
        setQuizState({ currentQuestion: 0, selectedAnswer: null, answeredQuestions: new Set(), score: 0, results: [] });
        setPage('take-quiz');
      } else {
        setPage('review-quiz');
      }

    } catch (error) {
      clearInterval(progressInterval);
      setGeneration({ isGenerating: false, step: '', progress: 0, error: error.message });
      setPage('create-quiz');
      showToast(`❌ Error: ${error.message}`, 'error');
    }
  };

  const createClass = () => {
    if (!modalInput.trim()) {
      showToast('⚠️ Please enter a class name', 'error');
      return;
    }
    const newClass = { id: `class_${Date.now()}`, name: modalInput.trim(), code: generateClassCode(), students: [], createdAt: Date.now() };
    setClasses(prev => [...prev, newClass]);
    setCurrentClass(newClass);
    showToast(`✅ Class "${newClass.name}" created! Code: ${newClass.code}`, 'success');
    setModal(null);
    setModalInput('');
  };

  const joinClass = () => {
    const code = joinCodeInput.toUpperCase().trim();
    if (!code) {
      showToast('⚠️ Please enter a class code', 'error');
      return;
    }
    if (!user?.name) {
      showToast('⚠️ Please log in first', 'error');
      return;
    }
    const foundClass = classes.find(c => c.code === code);
    if (foundClass) {
      // Check if already joined
      if (joinedClasses.some(c => c.id === foundClass.id)) {
        showToast('ℹ️ You already joined this class', 'info');
        return;
      }
      const studentName = user.name;
      const updatedClass = { ...foundClass, students: [...foundClass.students, { id: `s_${Date.now()}`, name: studentName, joinedAt: Date.now() }] };
      setClasses(prev => prev.map(c => c.id === foundClass.id ? updatedClass : c));
      setJoinedClasses(prev => [...prev, updatedClass]);
      showToast(`✅ Joined "${foundClass.name}"!`, 'success');
      setJoinCodeInput('');
    } else {
      showToast('❌ Invalid class code. Check with your teacher.', 'error');
    }
  };

  const assignQuiz = (quizId) => {
    if (!currentClass && classes.length > 0) {
      setCurrentClass(classes[0]);
    }
    if (!currentClass && classes.length === 0) {
      showToast('⚠️ Create a class first!', 'error');
      setModal(null);
      return;
    }
    const targetClass = currentClass || classes[0];
    const newAssignment = { id: `assign_${Date.now()}`, quizId, classId: targetClass.id, createdAt: Date.now(), submissions: [] };
    setAssignments(prev => [...prev, newAssignment]);
    const quiz = quizzes.find(q => q.id === quizId);
    showToast(`✅ "${quiz?.name}" assigned to ${targetClass.name}!`, 'success');
    setModal(null);
  };

  const submitQuizResult = (assignmentId, score, total, answers) => {
    const submission = { id: `sub_${Date.now()}`, assignmentId, studentName: user?.name || 'Student', score, total, percentage: Math.round((score / total) * 100), answers, submittedAt: Date.now() };
    setSubmissions(prev => [...prev, submission]);
  };

  const selectAnswer = (index) => {
    if (!quizState.answeredQuestions.has(quizState.currentQuestion)) {
      setQuizState(s => ({ ...s, selectedAnswer: index }));
    }
  };

  const checkAnswer = () => {
    if (quizState.selectedAnswer === null) return;
    const q = currentQuiz.questions[quizState.currentQuestion];
    const isCorrect = q.options[quizState.selectedAnswer].isCorrect;
    
    const newAnswered = new Set(quizState.answeredQuestions);
    newAnswered.add(quizState.currentQuestion);
    
    const newResults = [...quizState.results];
    newResults[quizState.currentQuestion] = { correct: isCorrect, selected: quizState.selectedAnswer };
    
    setQuizState(s => ({ ...s, score: isCorrect ? s.score + 1 : s.score, answeredQuestions: newAnswered, results: newResults }));
    
    setStudentProgress(p => {
      const newHistory = { ...p.topicHistory };
      if (!newHistory[q.topic]) newHistory[q.topic] = { correct: 0, total: 0 };
      newHistory[q.topic].total++;
      if (isCorrect) newHistory[q.topic].correct++;
      return { ...p, totalQuestions: p.totalQuestions + 1, totalScore: p.totalScore + (isCorrect ? 1 : 0), topicHistory: newHistory };
    });
  };

  const nextQuestion = () => {
    if (quizState.currentQuestion < currentQuiz.questions.length - 1) {
      setQuizState(s => ({ ...s, currentQuestion: s.currentQuestion + 1, selectedAnswer: null }));
    } else {
      setStudentProgress(p => ({ ...p, quizzesTaken: p.quizzesTaken + 1, recentScores: [...p.recentScores.slice(-7), Math.round((quizState.score / currentQuiz.questions.length) * 100)] }));
      if (currentAssignment) {
        submitQuizResult(currentAssignment.id, quizState.score, currentQuiz.questions.length, quizState.results);
        setCurrentAssignment(null);
      }
      setPage('quiz-results');
    }
  };

  const publishQuiz = () => {
    const published = { ...currentQuiz, published: true };
    setQuizzes(prev => [...prev, published]);
    setQuestionBank(prev => [...prev, ...currentQuiz.questions]);
    
    // Clear quiz form for next quiz
    setQuizContent('');
    setQuizSubject('');
    setQuizNameInput('');
    setNumQuestions(10);
    setDifficulty('mixed');
    
    showToast('✅ Quiz published!', 'success');
    
    // Show next steps modal
    setModal({
      type: 'next-steps',
      title: '🎉 Quiz Published!',
      quizName: published.name,
      questionCount: published.questions.length
    });
  };

  const startPractice = (topic) => {
    const available = questionBank.filter(q => topic === 'all' || q.topic === topic);
    if (available.length === 0) { showToast('No questions available', 'error'); return; }
    const selected = shuffleArray(available).slice(0, 5).map(q => ({ ...q, options: shuffleArray([...q.options]) }));
    setCurrentQuiz({ id: `practice_${Date.now()}`, name: `${topic} Practice`, questions: selected });
    setQuizState({ currentQuestion: 0, selectedAnswer: null, answeredQuestions: new Set(), score: 0, results: [] });
    setPage('take-quiz');
  };

  const startAssignment = (assignment) => {
    const quiz = quizzes.find(q => q.id === assignment.quizId);
    if (!quiz) { showToast('Quiz not found', 'error'); return; }
    setCurrentQuiz({ ...quiz, questions: quiz.questions.map(q => ({ ...q, options: shuffleArray([...q.options]) })) });
    setCurrentAssignment(assignment);
    setQuizState({ currentQuestion: 0, selectedAnswer: null, answeredQuestions: new Set(), score: 0, results: [] });
    setPage('take-quiz');
  };

  const resetData = async () => {
    setQuestionBank([]); setQuizzes([]); setClasses([]); setJoinedClasses([]); setAssignments([]); setSubmissions([]);
    setStudentProgress({ quizzesTaken: 0, totalScore: 0, totalQuestions: 0, topicHistory: {}, recentScores: [] });
    setQuizContent(''); setQuizSubject(''); setQuizNameInput(''); setJoinCodeInput('');
    setCurrentClass(null); setCurrentQuiz({ id: null, name: '', questions: [], published: false });
    
    // Clear saved data
    if (user) {
      try {
        await storage.delete(`quizforge-data-${user.email}`);
      } catch (err) {
        console.log('Could not clear data');
      }
    }
    
    showToast('🔄 All data reset!', 'info');
  };

  // Derived values
  const avgScore = studentProgress.totalQuestions > 0 ? Math.round((studentProgress.totalScore / studentProgress.totalQuestions) * 100) : 0;
  const topicScores = Object.entries(studentProgress.topicHistory || {}).map(([topic, data]) => ({ topic, score: Math.round((data.correct / data.total) * 100), total: data.total })).sort((a, b) => a.score - b.score);
  const weakTopics = topicScores.filter(t => t.score < 70);
  const pendingAssignments = assignments.filter(a => joinedClasses.some(c => c.id === a.classId) && !submissions.some(s => s.assignmentId === a.id && s.studentName === user?.name));
  const selectedClass = currentClass || classes[0];
  const classAssignments = assignments.filter(a => a.classId === selectedClass?.id);
  // Redirect to auth if trying to access protected pages while not logged in
  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      const protectedPages = ['teacher-dashboard', 'student-dashboard', 'creator-dashboard', 'create-quiz', 'class-manager', 'student-classes', 'profile', 'review-quiz', 'take-quiz', 'quiz-results', 'generating'];
      if (protectedPages.includes(page)) {
        setPage('auth');
      }
    }
  }, [page, isLoggedIn, isLoading]);

  const classSubmissions = submissions.filter(s => classAssignments.some(a => a.id === s.assignmentId));

  // Loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">⚡</div>
          <p className="text-white text-xl font-semibold">QuizForge</p>
          <p className="text-indigo-300 mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-indigo-600'} text-white px-6 py-3 rounded-xl shadow-lg z-50`}>
          {toast.message}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setModal(null); setModalInput(''); }}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{modal.title}</h3>
            
            {/* Input Modal */}
            {modal.type === 'input' && (
              <>
                <input
                  type="text"
                  value={modalInput}
                  onChange={e => setModalInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && modal.onConfirm()}
                  placeholder={modal.placeholder}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl mb-4 focus:border-indigo-500 focus:outline-none"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button onClick={() => { setModal(null); setModalInput(''); }} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg">Cancel</button>
                  <button onClick={modal.onConfirm} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium">{modal.confirmText}</button>
                </div>
              </>
            )}
            
            {/* Select Quiz Modal */}
            {modal.type === 'select' && (
              <>
                <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                  {quizzes.length > 0 ? quizzes.map(quiz => (
                    <button key={quiz.id} onClick={() => assignQuiz(quiz.id)} className="w-full p-3 text-left bg-slate-50 hover:bg-indigo-50 rounded-lg border border-slate-200">
                      <p className="font-medium">{quiz.name}</p>
                      <p className="text-sm text-slate-500">{quiz.questions.length} questions</p>
                    </button>
                  )) : (
                    <p className="text-slate-500 text-center py-4">No quizzes available. Create one first!</p>
                  )}
                </div>
                <button onClick={() => { setModal(null); setModalInput(''); }} className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg">Close</button>
              </>
            )}
            
            {/* Next Steps Modal (after publishing) */}
            {modal.type === 'next-steps' && (
              <>
                <div className="text-center mb-4">
                  <div className="text-5xl mb-2">🎉</div>
                  <p className="text-slate-600">"{modal.quizName}" with {modal.questionCount} questions is ready!</p>
                </div>
                
                {userType === 'teacher' ? (
                  <>
                    <div className="bg-slate-50 rounded-xl p-4 mb-4">
                      <h4 className="font-semibold text-slate-900 mb-3">What's Next?</h4>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                          <div>
                            <p className="font-medium text-slate-900">Create a Class</p>
                            <p className="text-sm text-slate-500">Get a code to share with students</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                          <div>
                            <p className="font-medium text-slate-900">Assign Quiz to Class</p>
                            <p className="text-sm text-slate-500">Students will see it on their dashboard</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                          <div>
                            <p className="font-medium text-slate-900">Track Results</p>
                            <p className="text-sm text-slate-500">See scores as students complete</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => { setModal(null); setPage('teacher-dashboard'); }} 
                        className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg"
                      >
                        Go to Dashboard
                      </button>
                      <button 
                        onClick={() => { 
                          setModal({ type: 'input', title: 'Create New Class', placeholder: 'Class name (e.g., Economics 101)', confirmText: 'Create', onConfirm: createClass });
                        }} 
                        className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium"
                      >
                        Create Class →
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-amber-50 rounded-xl p-4 mb-4">
                      <h4 className="font-semibold text-slate-900 mb-3">What's Next?</h4>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                          <div>
                            <p className="font-medium text-slate-900">Practice Your Quiz</p>
                            <p className="text-sm text-slate-500">Test the questions yourself</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                          <div>
                            <p className="font-medium text-slate-900">Create More Quizzes</p>
                            <p className="text-sm text-slate-500">Upload different content</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                          <div>
                            <p className="font-medium text-slate-900">Track Your Progress</p>
                            <p className="text-sm text-slate-500">See your practice scores improve</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => { setModal(null); setPage(getDashboard()); }} 
                        className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg"
                      >
                        Go to Dashboard
                      </button>
                      <button 
                        onClick={() => { 
                          setModal(null);
                          setPage('create-quiz');
                        }} 
                        className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-lg font-medium"
                      >
                        Create Another →
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* LANDING PAGE */}
      {page === 'landing' && (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900">
          <nav className="px-6 py-4 flex justify-between items-center max-w-7xl mx-auto">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <span className="text-xl font-bold text-white">QuizForge</span>
            </div>
            <div className="flex gap-3">
              {isLoggedIn ? (
                <>
                  <button onClick={() => setPage('profile')} className="px-4 py-2 text-white/80 hover:text-white flex items-center gap-2">
                    <span className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-sm">{user?.name?.charAt(0).toUpperCase()}</span>
                    {user?.name}
                  </button>
                  <button onClick={() => setPage(getDashboard())} className="px-4 py-2 bg-white text-indigo-900 rounded-lg font-medium">Dashboard</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setAuthMode('login'); setPage('auth'); }} className="px-4 py-2 text-white/80 hover:text-white">Log In</button>
                  <button onClick={() => { setAuthMode('signup'); setPage('auth'); }} className="px-4 py-2 bg-white text-indigo-900 rounded-lg font-medium">Sign Up</button>
                </>
              )}
            </div>
          </nav>

          <div className="max-w-7xl mx-auto px-6 pt-12 md:pt-16 pb-8 md:pb-12">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 text-amber-400 text-sm rounded-full mb-4">
                🎯 AI-Powered Assessment Platform
              </div>
              <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight mb-4 md:mb-6">
                Turn Course Materials into <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Smart Quizzes</span> in Seconds
              </h1>
              <p className="text-base md:text-xl text-indigo-200 mb-6">Upload slides, readings, or case studies. Our AI generates questions that test real understanding.</p>
              <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                {isLoggedIn ? (
                  <button onClick={() => setPage(getDashboard())} className="px-6 py-3 bg-white text-indigo-900 rounded-xl font-semibold hover:bg-indigo-100 shadow-lg text-center">
                    Go to Dashboard →
                  </button>
                ) : (
                  <>
                    <button onClick={() => { setAuthMode('signup'); setAuthForm(f => ({ ...f, role: 'teacher' })); setPage('auth'); }} className="px-5 py-3 bg-white text-indigo-900 rounded-xl font-semibold hover:bg-indigo-100 shadow-lg text-sm">👩‍🏫 I'm a Teacher</button>
                    <button onClick={() => { setAuthMode('signup'); setAuthForm(f => ({ ...f, role: 'student' })); setPage('auth'); }} className="px-5 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-500 border border-indigo-500 text-sm">👨‍🎓 I'm a Student</button>
                    <button onClick={() => { setAuthMode('signup'); setAuthForm(f => ({ ...f, role: 'creator' })); setPage('auth'); }} className="px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:from-amber-400 hover:to-orange-400 text-sm">✨ I'm Just Making Quizzes</button>
                  </>
                )}
              </div>
            </div>

            {/* Preview */}
            <div className="mt-8 md:mt-12 max-w-xl mx-auto">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-4 md:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500"></div><div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div><div className="w-2.5 h-2.5 rounded-full bg-green-500"></div></div>
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-xs">Score: 2/2</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-1.5 mb-4"><div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full w-2/3"></div></div>
                <div className="flex gap-2 mb-3">
                  <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-xs rounded-full">Game Theory</span>
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-xs rounded-full">Intermediate</span>
                </div>
                <p className="text-white text-sm md:text-base font-medium mb-3">Why does cooperation become harder as the number of firms increases?</p>
                <div className="space-y-1.5 mb-3">
                  <div className="p-2 rounded-lg border bg-slate-800/50 border-slate-600"><div className="flex items-center gap-2"><span className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-700 text-slate-300 text-xs font-bold">A</span><span className="text-white text-xs">More administrative complexity</span></div></div>
                  <div className="p-2 rounded-lg border bg-green-500/20 border-green-500"><div className="flex items-center gap-2"><span className="w-5 h-5 flex items-center justify-center rounded-full bg-green-500 text-white text-xs font-bold">B</span><span className="text-white text-xs flex-1">Each firm's share shrinks, but deviation gains stay constant</span><span className="text-green-400 text-xs">✓</span></div></div>
                  <div className="p-2 rounded-lg border bg-slate-800/30 border-slate-700 opacity-50"><div className="flex items-center gap-2"><span className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-700 text-slate-300 text-xs font-bold">C</span><span className="text-white text-xs">Government pays more attention</span></div></div>
                  <div className="p-2 rounded-lg border bg-slate-800/30 border-slate-700 opacity-50"><div className="flex items-center gap-2"><span className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-700 text-slate-300 text-xs font-bold">D</span><span className="text-white text-xs">Communication costs increase</span></div></div>
                </div>
                <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-blue-400 font-medium text-xs mb-0.5">💡 Explanation</p>
                  <p className="text-slate-300 text-xs leading-relaxed">With n firms sharing profit, each gets π/n. As n increases, cooperation value shrinks while deviation gains remain attractive.</p>
                </div>
              </div>
            </div>
          </div>

          {/* How it Works */}
          <div className="bg-white py-12">
            <div className="max-w-4xl mx-auto px-6">
              <h2 className="text-xl font-bold text-center text-slate-900 mb-8">How It Works</h2>
              <div className="grid md:grid-cols-2 gap-8">
                {/* Teachers Column */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-indigo-600 mb-3 text-center">👩‍🏫 For Teachers</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: '📤', title: 'Upload', desc: 'PDFs & slides' },
                      { icon: '🧠', title: 'Generate', desc: 'AI creates quiz/exam' },
                      { icon: '📨', title: 'Assign', desc: 'Share code' },
                      { icon: '📊', title: 'Track', desc: 'View results' }
                    ].map((item, i) => (
                      <div key={i} className="bg-white/80 rounded-xl p-3 text-center">
                        <div className="text-xl mb-1">{item.icon}</div>
                        <h4 className="font-semibold text-slate-900 text-xs">{item.title}</h4>
                        <p className="text-slate-500 text-xs">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Students Column */}
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-blue-600 mb-3 text-center">👨‍🎓 For Students</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: '🔑', title: 'Join', desc: 'Enter code' },
                      { icon: '✍️', title: 'Take', desc: 'Do quizzes/exams' },
                      { icon: '💡', title: 'Learn', desc: 'Get feedback' },
                      { icon: '🎯', title: 'Focus', desc: 'AI study tips' }
                    ].map((item, i) => (
                      <div key={i} className="bg-white/80 rounded-xl p-3 text-center">
                        <div className="text-xl mb-1">{item.icon}</div>
                        <h4 className="font-semibold text-slate-900 text-xs">{item.title}</h4>
                        <p className="text-slate-500 text-xs">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Student Study Section */}
              <div className="mt-8 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-200">
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <div className="text-4xl">📚</div>
                  <div className="text-center md:text-left">
                    <h3 className="font-semibold text-slate-900 mb-1">Study Smarter, Not Harder</h3>
                    <p className="text-slate-600 text-sm">Upload your course materials, past exams, or lecture notes — our AI generates practice exams tailored to your class. Perfect for exam prep!</p>
                  </div>
                  <button onClick={() => { setAuthMode('signup'); setAuthForm(f => ({ ...f, role: 'student' })); setPage('auth'); }} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-lg font-medium text-sm whitespace-nowrap">
                    Start Practicing →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* AUTH PAGE */}
      {page === 'auth' && (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">⚡</div>
              <h1 className="text-2xl font-bold text-slate-900">{authMode === 'login' ? 'Welcome Back' : 'Create Account'}</h1>
              <p className="text-slate-600 mt-1">{authMode === 'login' ? 'Log in to continue' : 'Sign up to get started'}</p>
            </div>
            
            {authError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {authError}
              </div>
            )}
            
            <div className="space-y-4">
              {authMode === 'signup' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={authForm.name}
                    onChange={e => setAuthForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Your full name"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={authForm.email}
                  onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && (authMode === 'login' ? handleLogin() : handleSignup())}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              
              {authMode === 'signup' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">I am a...</label>
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      onClick={() => setAuthForm(f => ({ ...f, role: 'teacher' }))}
                      className={`p-4 rounded-xl border-2 text-left transition flex items-center gap-4 ${authForm.role === 'teacher' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <span className="text-3xl">👩‍🏫</span>
                      <div>
                        <span className="font-medium text-slate-900 block">Teacher</span>
                        <p className="text-xs text-slate-500">Create quizzes, manage classes, track student progress</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setAuthForm(f => ({ ...f, role: 'student' }))}
                      className={`p-4 rounded-xl border-2 text-left transition flex items-center gap-4 ${authForm.role === 'student' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <span className="text-3xl">👨‍🎓</span>
                      <div>
                        <span className="font-medium text-slate-900 block">Student</span>
                        <p className="text-xs text-slate-500">Join classes, take assigned quizzes, track your learning</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setAuthForm(f => ({ ...f, role: 'creator' }))}
                      className={`p-4 rounded-xl border-2 text-left transition flex items-center gap-4 ${authForm.role === 'creator' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <span className="text-3xl">✨</span>
                      <div>
                        <span className="font-medium text-slate-900 block">Quiz Creator</span>
                        <p className="text-xs text-slate-500">Just here to make great quizzes — no classroom needed</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}
              
              <button
                onClick={authMode === 'login' ? handleLogin : handleSignup}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl"
              >
                {authMode === 'login' ? 'Log In' : 'Create Account'}
              </button>
            </div>
            
            <div className="mt-6 text-center text-sm">
              {authMode === 'login' ? (
                <p className="text-slate-600">
                  Don't have an account? <button onClick={() => { setAuthMode('signup'); setAuthError(''); }} className="text-indigo-600 font-medium hover:underline">Sign up</button>
                </p>
              ) : (
                <p className="text-slate-600">
                  Already have an account? <button onClick={() => { setAuthMode('login'); setAuthError(''); }} className="text-indigo-600 font-medium hover:underline">Log in</button>
                </p>
              )}
            </div>
            
            <button onClick={() => setPage('landing')} className="w-full mt-4 text-slate-500 text-sm hover:text-slate-700">
              ← Back to home
            </button>
          </div>
        </div>
      )}
      
      {/* PROFILE PAGE */}
      {page === 'profile' && (
        <div className="min-h-screen bg-slate-100">
          <nav className="bg-white border-b border-slate-200 px-6 py-3 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('landing')}>
                  <span className="text-xl">⚡</span>
                  <span className="font-bold text-slate-900">QuizForge</span>
                </div>
                <button onClick={() => setPage(getDashboard())} className="text-slate-600 hover:text-slate-900 text-sm font-medium">Dashboard</button>
              </div>
              <span className={`px-3 py-1 ${userType === 'teacher' ? 'bg-purple-100 text-purple-700' : userType === 'student' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'} text-xs font-medium rounded-full`}>
                {userType === 'teacher' ? '👩‍🏫 Teacher' : userType === 'student' ? '👨‍🎓 Student' : '✨ Creator'}
              </span>
            </div>
          </nav>
          <div className="max-w-2xl mx-auto px-6 py-8">
            <button onClick={() => setPage(getDashboard())} className="text-slate-600 hover:text-slate-900 mb-4 text-sm">← Back to Dashboard</button>
            
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
              <div className="flex items-center gap-4 mb-8">
                <div className={`w-20 h-20 bg-gradient-to-br ${userType === 'creator' ? 'from-amber-500 to-orange-600' : 'from-indigo-500 to-purple-600'} rounded-full flex items-center justify-center text-white text-3xl font-bold`}>
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{user?.name}</h1>
                  <p className="text-slate-600">{user?.email}</p>
                  <span className={`inline-block mt-1 px-2 py-1 ${userType === 'teacher' ? 'bg-purple-100 text-purple-700' : userType === 'student' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'} text-xs font-medium rounded-full`}>
                    {userType === 'teacher' ? '👩‍🏫 Teacher' : userType === 'student' ? '👨‍🎓 Student' : '✨ Quiz Creator'}
                  </span>
                </div>
              </div>
              
              <div className="border-t border-slate-200 pt-6">
                <h2 className="font-semibold text-slate-900 mb-4">Your Stats</h2>
                <div className="grid grid-cols-2 gap-4">
                  {userType === 'teacher' ? (
                    <>
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-2xl font-bold text-indigo-600">{quizzes.length}</p>
                        <p className="text-sm text-slate-600">Quizzes Created</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-2xl font-bold text-purple-600">{classes.length}</p>
                        <p className="text-sm text-slate-600">Classes</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-2xl font-bold text-green-600">{classes.reduce((s, c) => s + c.students.length, 0)}</p>
                        <p className="text-sm text-slate-600">Total Students</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-2xl font-bold text-amber-600">{submissions.length}</p>
                        <p className="text-sm text-slate-600">Submissions</p>
                      </div>
                    </>
                  ) : userType === 'student' ? (
                    <>
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-2xl font-bold text-indigo-600">{studentProgress.quizzesTaken}</p>
                        <p className="text-sm text-slate-600">Quizzes Taken</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-2xl font-bold text-green-600">{avgScore}%</p>
                        <p className="text-sm text-slate-600">Average Score</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-2xl font-bold text-purple-600">{joinedClasses.length}</p>
                        <p className="text-sm text-slate-600">Classes Joined</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-2xl font-bold text-amber-600">{studentProgress.totalQuestions}</p>
                        <p className="text-sm text-slate-600">Questions Answered</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-2xl font-bold text-amber-600">{quizzes.length}</p>
                        <p className="text-sm text-slate-600">Quizzes Created</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-2xl font-bold text-orange-600">{questionBank.length}</p>
                        <p className="text-sm text-slate-600">Questions Generated</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-2xl font-bold text-indigo-600">{studentProgress.quizzesTaken}</p>
                        <p className="text-sm text-slate-600">Quizzes Practiced</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-2xl font-bold text-green-600">{avgScore}%</p>
                        <p className="text-sm text-slate-600">Practice Score</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div className="border-t border-slate-200 pt-6 mt-6">
                <h2 className="font-semibold text-slate-900 mb-4">Account Actions</h2>
                <div className="space-y-3">
                  <button
                    onClick={resetData}
                    className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-left flex items-center gap-3"
                  >
                    <span className="text-xl">🔄</span>
                    <div>
                      <p className="font-medium text-slate-900">Reset All Data</p>
                      <p className="text-sm text-slate-500">Clear all quizzes, classes, and progress</p>
                    </div>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full p-3 bg-red-50 hover:bg-red-100 rounded-xl text-left flex items-center gap-3"
                  >
                    <span className="text-xl">🚪</span>
                    <div>
                      <p className="font-medium text-red-700">Log Out</p>
                      <p className="text-sm text-red-500">Sign out of your account</p>
                    </div>
                  </button>
                </div>
              </div>
              
              <div className="border-t border-slate-200 pt-4 mt-6 text-center text-xs text-slate-400">
                Account created {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'recently'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TEACHER DASHBOARD */}
      {page === 'teacher-dashboard' && (
        <div className="min-h-screen bg-slate-100">
          <nav className="bg-white border-b border-slate-200 px-6 py-3 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('landing')}><span className="text-xl">⚡</span><span className="font-bold text-slate-900">QuizForge</span></div>
                <button onClick={() => setPage('teacher-dashboard')} className="text-slate-600 hover:text-slate-900 text-sm font-medium">Dashboard</button>
                <button onClick={() => setPage('create-quiz')} className="text-slate-600 hover:text-slate-900 text-sm font-medium">Create Quiz</button>
                <button onClick={() => setPage('class-manager')} className="text-slate-600 hover:text-slate-900 text-sm font-medium">Classes</button>
              </div>
              <button onClick={() => setPage('profile')} className="flex items-center gap-2 px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 text-sm font-medium rounded-full">
                <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs">{user?.name?.charAt(0).toUpperCase() || '?'}</span>
                {user?.name || 'Teacher'}
              </button>
            </div>
          </nav>
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex justify-between items-start mb-8">
              <div><h1 className="text-2xl font-bold text-slate-900">Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋</h1><p className="text-slate-600">Create assessments and track progress</p></div>
              <button onClick={() => setPage('create-quiz')} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-500 shadow-lg">⚡ Create Quiz</button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5"><p className="text-3xl font-bold text-slate-900">{classes.length}</p><p className="text-sm text-slate-500">Classes</p></div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5"><p className="text-3xl font-bold text-slate-900">{quizzes.length}</p><p className="text-sm text-slate-500">Quizzes</p></div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5"><p className="text-3xl font-bold text-slate-900">{classes.reduce((s, c) => s + c.students.length, 0)}</p><p className="text-sm text-slate-500">Students</p></div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5"><p className="text-3xl font-bold text-green-600">{submissions.length > 0 ? Math.round(submissions.reduce((s, sub) => s + sub.percentage, 0) / submissions.length) : '--'}%</p><p className="text-sm text-slate-500">Avg Score</p></div>
            </div>
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 grid md:grid-cols-2 gap-4">
                <button onClick={() => setPage('create-quiz')} className="p-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white text-left"><span className="text-3xl mb-2 block">⚡</span><span className="font-semibold block">Generate Quiz</span><span className="text-sm text-indigo-200">From any material</span></button>
                <button onClick={() => setModal({ type: 'input', title: 'Create New Class', placeholder: 'Class name', confirmText: 'Create', onConfirm: createClass })} className="p-6 bg-white border-2 border-slate-200 rounded-xl text-left hover:border-indigo-300"><span className="text-3xl mb-2 block">👥</span><span className="font-semibold text-slate-900 block">Create Class</span><span className="text-sm text-slate-500">Get join code</span></button>
                <button onClick={() => setPage('class-manager')} className="p-6 bg-white border-2 border-slate-200 rounded-xl text-left hover:border-indigo-300"><span className="text-3xl mb-2 block">📊</span><span className="font-semibold text-slate-900 block">View Results</span><span className="text-sm text-slate-500">Track performance</span></button>
                <button onClick={() => setPage('class-manager')} className="p-6 bg-white border-2 border-slate-200 rounded-xl text-left hover:border-indigo-300"><span className="text-3xl mb-2 block">📨</span><span className="font-semibold text-slate-900 block">Assign Quiz</span><span className="text-sm text-slate-500">Send to classes</span></button>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Recent Submissions</h3>
                {submissions.length > 0 ? submissions.slice(-5).reverse().map((sub, i) => (
                  <div key={i} className="flex items-center gap-3 p-2">
                    <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">{sub.studentName.substring(0, 2).toUpperCase()}</div>
                    <div className="flex-1"><p className="text-sm font-medium text-slate-900">{sub.studentName}</p><p className="text-xs text-slate-500">{sub.score}/{sub.total}</p></div>
                    <span className={`font-semibold ${sub.percentage >= 80 ? 'text-green-600' : sub.percentage >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{sub.percentage}%</span>
                  </div>
                )) : <p className="text-slate-500 text-sm text-center py-8">No submissions yet</p>}
              </div>
            </div>
            {classes.length > 0 && (
              <div className="mt-8"><h3 className="font-semibold text-slate-900 mb-4">Your Classes</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {classes.map(cls => (
                    <div key={cls.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                      <div className="flex justify-between items-start mb-3"><h4 className="font-semibold text-slate-900">{cls.name}</h4><span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-mono rounded">{cls.code}</span></div>
                      <p className="text-sm text-slate-500 mb-4">{cls.students.length} students</p>
                      <button onClick={() => { setCurrentClass(cls); setPage('class-manager'); }} className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium">Manage →</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {quizzes.length > 0 && (
              <div className="mt-8"><h3 className="font-semibold text-slate-900 mb-4">Your Quizzes</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {quizzes.map(quiz => {
                    const assignedTo = assignments.filter(a => a.quizId === quiz.id).length;
                    const totalSubmissions = submissions.filter(s => assignments.some(a => a.id === s.assignmentId && a.quizId === quiz.id)).length;
                    return (
                      <div key={quiz.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                        <h4 className="font-semibold text-slate-900 mb-1">{quiz.name}</h4>
                        <p className="text-sm text-slate-500 mb-3">{quiz.questions.length} questions</p>
                        <div className="flex gap-2 text-xs text-slate-500 mb-4">
                          <span className="px-2 py-1 bg-slate-100 rounded">{assignedTo} class{assignedTo !== 1 ? 'es' : ''}</span>
                          <span className="px-2 py-1 bg-slate-100 rounded">{totalSubmissions} submissions</span>
                        </div>
                        <button 
                          onClick={() => {
                            setCurrentQuiz(quiz);
                            setPage('review-quiz');
                          }} 
                          className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium"
                        >
                          View Quiz →
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATOR DASHBOARD */}
      {page === 'creator-dashboard' && (
        <div className="min-h-screen bg-slate-100">
          <nav className="bg-white border-b border-slate-200 px-6 py-3 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('landing')}><span className="text-xl">⚡</span><span className="font-bold text-slate-900">QuizForge</span></div>
                <button onClick={() => setPage('creator-dashboard')} className="text-slate-600 hover:text-slate-900 text-sm font-medium">Dashboard</button>
                <button onClick={() => setPage('create-quiz')} className="text-slate-600 hover:text-slate-900 text-sm font-medium">Create Quiz</button>
              </div>
              <button onClick={() => setPage('profile')} className="flex items-center gap-2 px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 text-sm font-medium rounded-full">
                <span className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs">{user?.name?.charAt(0).toUpperCase() || '?'}</span>
                {user?.name || 'Creator'}
              </button>
            </div>
          </nav>
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Hey{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! ✨</h1>
                <p className="text-slate-600">Ready to create something amazing?</p>
              </div>
              <button onClick={() => setPage('create-quiz')} className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium hover:from-amber-400 hover:to-orange-400 shadow-lg">✨ Create Quiz</button>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5"><p className="text-3xl font-bold text-amber-600">{quizzes.length}</p><p className="text-sm text-slate-500">Quizzes Created</p></div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5"><p className="text-3xl font-bold text-orange-600">{questionBank.length}</p><p className="text-sm text-slate-500">Questions Generated</p></div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5"><p className="text-3xl font-bold text-indigo-600">{studentProgress.quizzesTaken}</p><p className="text-sm text-slate-500">Practice Sessions</p></div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5"><p className="text-3xl font-bold text-green-600">{avgScore > 0 ? avgScore : '--'}%</p><p className="text-sm text-slate-500">Avg Practice Score</p></div>
            </div>
            
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Quick Actions */}
                <div className="grid md:grid-cols-2 gap-4">
                  <button onClick={() => setPage('create-quiz')} className="p-6 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl text-white text-left">
                    <span className="text-3xl mb-2 block">✨</span>
                    <span className="font-semibold block">Create New Quiz</span>
                    <span className="text-sm text-amber-100">Upload any content</span>
                  </button>
                  {questionBank.length > 0 && (
                    <button onClick={() => startPractice('all')} className="p-6 bg-white border-2 border-slate-200 rounded-xl text-left hover:border-amber-300">
                      <span className="text-3xl mb-2 block">🎯</span>
                      <span className="font-semibold text-slate-900 block">Practice Mode</span>
                      <span className="text-sm text-slate-500">Test your own quizzes</span>
                    </button>
                  )}
                </div>
                
                {/* Your Quizzes */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h3 className="font-semibold text-slate-900 mb-4">Your Quizzes</h3>
                  {quizzes.length > 0 ? (
                    <div className="space-y-3">
                      {quizzes.map(quiz => (
                        <div key={quiz.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                          <div>
                            <p className="font-medium text-slate-900">{quiz.name}</p>
                            <p className="text-sm text-slate-500">{quiz.questions.length} questions</p>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => { setCurrentQuiz(quiz); setPage('review-quiz'); }} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm">View</button>
                            <button onClick={() => {
                              const selected = shuffleArray([...quiz.questions]).slice(0, 10).map(q => ({ ...q, options: shuffleArray([...q.options]) }));
                              setCurrentQuiz({ ...quiz, questions: selected });
                              setQuizState({ currentQuestion: 0, selectedAnswer: null, answeredQuestions: new Set(), score: 0, results: [] });
                              setPage('take-quiz');
                            }} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-white rounded-lg text-sm">Practice</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-5xl mb-4">📝</div>
                      <h4 className="text-lg font-semibold text-slate-900 mb-2">No Quizzes Yet</h4>
                      <p className="text-slate-600 mb-4">Upload your first content to generate a quiz!</p>
                      <button onClick={() => setPage('create-quiz')} className="px-4 py-2 bg-amber-500 text-white rounded-lg">Create Your First Quiz</button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Sidebar */}
              <div className="space-y-6">
                {/* Tips */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-6">
                  <h3 className="font-semibold text-slate-900 mb-3">💡 Creator Tips</h3>
                  <ul className="space-y-2 text-sm text-slate-700">
                    <li className="flex items-start gap-2"><span className="text-amber-500">✓</span> Upload PDFs, Word docs, or paste text</li>
                    <li className="flex items-start gap-2"><span className="text-amber-500">✓</span> More content = better questions</li>
                    <li className="flex items-start gap-2"><span className="text-amber-500">✓</span> Practice your own quizzes to test quality</li>
                    <li className="flex items-start gap-2"><span className="text-amber-500">✓</span> Mix difficulty levels for variety</li>
                  </ul>
                </div>
                
                {/* Recent Practice */}
                {studentProgress.recentScores.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="font-semibold text-slate-900 mb-4">Practice History</h3>
                    <div className="flex items-end gap-1 h-24">
                      {studentProgress.recentScores.map((score, i) => (
                        <div key={i} className="flex-1 bg-amber-500 rounded-t transition-all" style={{ height: `${score}%`, opacity: 0.4 + (score/100) * 0.6 }} />
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-2 text-center">Last {studentProgress.recentScores.length} practice sessions</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CLASS MANAGER */}
      {page === 'class-manager' && (
        <div className="min-h-screen bg-slate-100">
          <nav className="bg-white border-b border-slate-200 px-6 py-3 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('landing')}><span className="text-xl">⚡</span><span className="font-bold text-slate-900">QuizForge</span></div>
                <button onClick={() => setPage('teacher-dashboard')} className="text-slate-600 hover:text-slate-900 text-sm font-medium">Dashboard</button>
                <button onClick={() => setPage('create-quiz')} className="text-slate-600 hover:text-slate-900 text-sm font-medium">Create Quiz</button>
                <button onClick={() => setPage('class-manager')} className="text-slate-600 hover:text-slate-900 text-sm font-medium">Classes</button>
              </div>
              <button onClick={() => setPage('profile')} className="flex items-center gap-2 px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 text-sm font-medium rounded-full">
                <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs">{user?.name?.charAt(0).toUpperCase() || '?'}</span>
                {user?.name || 'Teacher'}
              </button>
            </div>
          </nav>
          <div className="max-w-7xl mx-auto px-6 py-8">
            <button onClick={() => setPage('teacher-dashboard')} className="text-slate-600 hover:text-slate-900 mb-4 text-sm">← Back</button>
            {classes.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                <div className="text-5xl mb-4">👥</div><h3 className="text-lg font-semibold text-slate-900 mb-2">No Classes Yet</h3>
                <button onClick={() => setModal({ type: 'input', title: 'Create New Class', placeholder: 'Class name (e.g., Economics 101)', confirmText: 'Create', onConfirm: createClass })} className="px-6 py-2 bg-indigo-600 text-white rounded-lg">Create Class</button>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    {/* Class selector dropdown */}
                    {classes.length > 1 ? (
                      <select 
                        value={selectedClass?.id || ''} 
                        onChange={e => setCurrentClass(classes.find(c => c.id === e.target.value))}
                        className="text-2xl font-bold text-slate-900 bg-transparent border-none cursor-pointer focus:outline-none pr-8"
                      >
                        {classes.map(cls => (
                          <option key={cls.id} value={cls.id}>{cls.name}</option>
                        ))}
                      </select>
                    ) : (
                      <h1 className="text-2xl font-bold text-slate-900">{selectedClass?.name}</h1>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-slate-600">Code:</span>
                      <span className="font-mono bg-slate-100 px-2 py-1 rounded text-indigo-600 font-bold">{selectedClass?.code}</span>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(selectedClass?.code || '');
                          showToast('📋 Code copied!', 'success');
                        }}
                        className="text-xs px-2 py-1 bg-indigo-100 text-indigo-600 rounded hover:bg-indigo-200"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setModal({ type: 'input', title: 'Create New Class', placeholder: 'Class name', confirmText: 'Create', onConfirm: createClass })} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200">+ New Class</button>
                    <button onClick={() => quizzes.length > 0 ? setModal({ type: 'select', title: 'Assign Quiz to ' + selectedClass?.name }) : showToast('Create a quiz first', 'error')} className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-500">+ Assign Quiz</button>
                  </div>
                </div>
                <div className="grid lg:grid-cols-3 gap-6">
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="font-semibold text-slate-900 mb-4">Students ({selectedClass?.students.length})</h3>
                    {selectedClass?.students.length > 0 ? selectedClass.students.map((student, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg mb-2">
                        <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">{student.name.substring(0, 2).toUpperCase()}</div>
                        <span className="text-sm text-slate-900">{student.name}</span>
                      </div>
                    )) : <p className="text-slate-500 text-sm text-center py-4">Share code <span className="font-mono bg-slate-100 px-1">{selectedClass?.code}</span></p>}
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="font-semibold text-slate-900 mb-4">Assigned Quizzes</h3>
                    {classAssignments.length > 0 ? classAssignments.map(a => {
                      const quiz = quizzes.find(q => q.id === a.quizId);
                      return <div key={a.id} className="p-3 bg-slate-50 rounded-lg mb-2"><p className="font-medium text-slate-900">{quiz?.name}</p><p className="text-sm text-slate-500">{submissions.filter(s => s.assignmentId === a.id).length} submissions</p></div>;
                    }) : <p className="text-slate-500 text-sm text-center py-4">No quizzes assigned</p>}
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="font-semibold text-slate-900 mb-4">Results</h3>
                    {classSubmissions.length > 0 ? classSubmissions.slice(-5).reverse().map((sub, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg mb-2">
                        <div><p className="text-sm font-medium text-slate-900">{sub.studentName}</p><p className="text-xs text-slate-500">{sub.score}/{sub.total}</p></div>
                        <span className={`font-semibold ${sub.percentage >= 80 ? 'text-green-600' : sub.percentage >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{sub.percentage}%</span>
                      </div>
                    )) : <p className="text-slate-500 text-sm text-center py-4">No results yet</p>}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* STUDENT DASHBOARD */}
      {page === 'student-dashboard' && (
        <div className="min-h-screen bg-slate-100">
          <nav className="bg-white border-b border-slate-200 px-6 py-3 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('landing')}><span className="text-xl">⚡</span><span className="font-bold text-slate-900">QuizForge</span></div>
                <button onClick={() => setPage('student-dashboard')} className="text-slate-600 hover:text-slate-900 text-sm font-medium">Dashboard</button>
                <button onClick={() => setPage('student-classes')} className="text-slate-600 hover:text-slate-900 text-sm font-medium">My Classes</button>
              </div>
              <button onClick={() => setPage('profile')} className="flex items-center gap-2 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm font-medium rounded-full">
                <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">{user?.name?.charAt(0).toUpperCase() || '?'}</span>
                {user?.name || 'Student'}
              </button>
            </div>
          </nav>
          <div className="max-w-7xl mx-auto px-6 py-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Hey{user?.name ? `, ${user.name.split(' ')[0]}` : ' there'}! 👋</h1>
            <p className="text-slate-600 mb-8">Ready to practice?</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5"><p className="text-3xl font-bold text-indigo-600">{studentProgress.quizzesTaken}</p><p className="text-sm text-slate-500">Quizzes Taken</p></div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5"><p className="text-3xl font-bold text-green-600">{avgScore}%</p><p className="text-sm text-slate-500">Average Score</p></div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5"><p className="text-3xl font-bold text-amber-600">{joinedClasses.length}</p><p className="text-sm text-slate-500">Classes</p></div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5"><p className="text-3xl font-bold text-purple-600">{studentProgress.totalQuestions}</p><p className="text-sm text-slate-500">Questions</p></div>
            </div>
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {pendingAssignments.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border-2 border-amber-300 p-6">
                    <h3 className="font-semibold text-slate-900 mb-4">📋 Assigned Quizzes</h3>
                    {pendingAssignments.map(a => {
                      const quiz = quizzes.find(q => q.id === a.quizId);
                      const assignedClass = classes.find(c => c.id === a.classId);
                      return (
                        <div key={a.id} className="flex items-center justify-between p-4 bg-amber-50 rounded-lg mb-2">
                          <div>
                            <p className="font-medium text-slate-900">{quiz?.name}</p>
                            <p className="text-sm text-slate-500">{quiz?.questions.length} questions • From: {assignedClass?.name || 'Unknown class'}</p>
                          </div>
                          <button onClick={() => startAssignment(a)} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-lg font-medium">Start →</button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex justify-between items-center mb-4"><h3 className="font-semibold text-slate-900">Self Practice</h3><span className="text-sm text-slate-500">{questionBank.length} questions</span></div>
                  {questionBank.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-5xl mb-4">📚</div><h4 className="text-lg font-semibold text-slate-900 mb-2">No Practice Questions Yet</h4><p className="text-slate-600 mb-6">Upload materials or join a class</p>
                      <div className="flex gap-3 justify-center">
                        <button onClick={() => setPage('create-quiz')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Upload Material</button>
                        <button onClick={() => setPage('student-classes')} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg">Join Class</button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {['All Topics', ...new Set(questionBank.map(q => q.topic))].map(topic => (
                        <button key={topic} onClick={() => startPractice(topic === 'All Topics' ? 'all' : topic)} className="w-full p-4 bg-slate-50 hover:bg-indigo-50 rounded-xl text-left flex justify-between items-center">
                          <div><p className="font-medium text-slate-900">{topic}</p><p className="text-sm text-slate-500">{topic === 'All Topics' ? questionBank.length : questionBank.filter(q => q.topic === topic).length} questions</p></div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
                  <div className="flex items-start gap-4">
                    <span className="text-4xl">📚</span>
                    <div><h3 className="font-semibold text-lg mb-1">Create Your Own Quiz</h3><p className="text-indigo-200 text-sm mb-4">Upload lecture notes to generate custom practice</p>
                      <button onClick={() => setPage('create-quiz')} className="px-5 py-2 bg-white text-indigo-600 rounded-lg font-medium">Upload & Generate →</button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                {weakTopics.length > 0 && (
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-6">
                    <h3 className="font-semibold text-slate-900 mb-2">🎯 AI Recommendation</h3><p className="text-slate-700 text-sm mb-4">Focus on these topics:</p>
                    {weakTopics.slice(0, 2).map(t => <div key={t.topic} className="p-3 bg-white rounded-lg border border-amber-200 mb-2"><div className="flex justify-between"><p className="font-medium text-amber-800">{t.topic}</p><span className="text-amber-600">{t.score}%</span></div></div>)}
                    <button onClick={() => startPractice(weakTopics[0].topic)} className="w-full mt-2 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium">Practice Weak Topics</button>
                  </div>
                )}
                {studentProgress.recentScores.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="font-semibold text-slate-900 mb-4">Recent Progress</h3>
                    <div className="flex items-end gap-1 h-24">{studentProgress.recentScores.map((score, i) => <div key={i} className="flex-1 bg-indigo-500 rounded-t" style={{ height: `${score}%`, opacity: 0.4 + (score/100) * 0.6 }} />)}</div>
                  </div>
                )}
                {joinedClasses.length === 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="font-semibold text-slate-900 mb-2">🔑 Join a Class</h3><p className="text-slate-600 text-sm mb-4">Enter your teacher's class code</p>
                    <button onClick={() => setPage('student-classes')} className="w-full py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium">Enter Code</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT CLASSES */}
      {page === 'student-classes' && (
        <div className="min-h-screen bg-slate-100">
          <nav className="bg-white border-b border-slate-200 px-6 py-3 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('landing')}><span className="text-xl">⚡</span><span className="font-bold text-slate-900">QuizForge</span></div>
                <button onClick={() => setPage('student-dashboard')} className="text-slate-600 hover:text-slate-900 text-sm font-medium">Dashboard</button>
                <button onClick={() => setPage('student-classes')} className="text-slate-600 hover:text-slate-900 text-sm font-medium">My Classes</button>
              </div>
              <button onClick={() => setPage('profile')} className="flex items-center gap-2 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm font-medium rounded-full">
                <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">{user?.name?.charAt(0).toUpperCase() || '?'}</span>
                {user?.name || 'Student'}
              </button>
            </div>
          </nav>
          <div className="max-w-3xl mx-auto px-6 py-8">
            <button onClick={() => setPage('student-dashboard')} className="text-slate-600 hover:text-slate-900 mb-4 text-sm">← Back</button>
            <h1 className="text-2xl font-bold text-slate-900 mb-6">My Classes</h1>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <h3 className="font-semibold text-slate-900 mb-4">Join a Class</h3>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Class Code</label>
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    value={joinCodeInput} 
                    onChange={e => setJoinCodeInput(e.target.value.toUpperCase())} 
                    onKeyDown={e => e.key === 'Enter' && joinClass()}
                    placeholder="e.g., ABC123" 
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg uppercase tracking-wider font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" 
                    maxLength={6} 
                  />
                  <button onClick={joinClass} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-500">Join</button>
                </div>
              </div>
            </div>
            {joinedClasses.length > 0 && (
              <div><h3 className="font-semibold text-slate-900 mb-4">Your Classes</h3>
                {joinedClasses.map(cls => {
                  const clsAssignments = assignments.filter(a => a.classId === cls.id);
                  const pending = clsAssignments.filter(a => !submissions.some(s => s.assignmentId === a.id && s.studentName === user?.name));
                  return (
                    <div key={cls.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-4">
                      <h4 className="font-semibold text-slate-900">{cls.name}</h4><p className="text-sm text-slate-500 mb-3">{clsAssignments.length} quizzes • {pending.length} pending</p>
                      {pending.length > 0 && <div className="p-3 bg-amber-50 rounded-lg"><p className="text-sm text-amber-800">📋 {pending.length} quiz{pending.length > 1 ? 'zes' : ''} to complete</p></div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE QUIZ */}
      {page === 'create-quiz' && (
        <div className="min-h-screen bg-slate-100">
          <nav className="bg-white border-b border-slate-200 px-6 py-3 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('landing')}><span className="text-xl">⚡</span><span className="font-bold text-slate-900">QuizForge</span></div>
              </div>
              <span className={`px-3 py-1 ${userType === 'teacher' ? 'bg-purple-100 text-purple-700' : userType === 'student' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'} text-xs font-medium rounded-full`}>
                {userType === 'teacher' ? '👩‍🏫 Teacher' : userType === 'student' ? '👨‍🎓 Student' : '✨ Creator'}
              </span>
            </div>
          </nav>
          <div className="max-w-3xl mx-auto px-6 py-8">
            <button onClick={() => setPage(getDashboard())} className="text-slate-600 hover:text-slate-900 mb-6 text-sm">← Back</button>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
              <div className="flex items-center gap-3 mb-6"><span className="text-3xl">⚡</span><h1 className="text-2xl font-bold text-slate-900">Create New Quiz</h1></div>
              {generation.error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700"><strong>Error:</strong> {generation.error}</div>}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Quiz Name</label>
                  <input type="text" value={quizNameInput} onChange={e => setQuizNameInput(e.target.value)} placeholder="e.g., Midterm Practice" className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Subject</label>
                  <input type="text" value={quizSubject} onChange={e => setQuizSubject(e.target.value)} placeholder="e.g., Microeconomics" className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Course Material</label>
                  <div className="mb-3">
                    <input ref={fileInputRef} type="file" accept=".docx,.pdf,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,text/plain" onChange={handleFileUpload} className="hidden" disabled={uploadProgress.active} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadProgress.active} className="px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-indigo-400 hover:text-indigo-600 w-full disabled:opacity-50 disabled:cursor-not-allowed">
                      {uploadProgress.active ? '⏳ Processing...' : '📄 Upload Word (.docx), PDF, or Text File'}
                    </button>
                  </div>
                  
                  {/* Upload Progress Bar */}
                  {uploadProgress.active && (
                    <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-sm font-medium text-indigo-700">{uploadProgress.step}</span>
                        </div>
                        <button 
                          onClick={cancelUpload}
                          className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="w-full bg-indigo-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress.progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-indigo-600 mt-1 text-right">{uploadProgress.progress}%</p>
                    </div>
                  )}
                  
                  <textarea value={quizContent} onChange={e => setQuizContent(e.target.value)} placeholder="Or paste your content here..." className="w-full h-48 px-4 py-3 border border-slate-300 rounded-xl resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" disabled={uploadProgress.active} />
                  <div className="flex justify-between mt-2 text-sm text-slate-500">
                    <span>{quizContent.length.toLocaleString()} characters</span>
                    <span>{quizContent.length < 500 ? '⚠️ Min 500 recommended' : '✓ Good'}</span>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Questions</label>
                    <select value={numQuestions} onChange={e => setNumQuestions(parseInt(e.target.value))} className="w-full px-4 py-3 border border-slate-300 rounded-xl">
                      <option value={5}>5</option><option value={10}>10</option><option value={15}>15</option><option value={20}>20</option><option value={25}>25</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Difficulty</label>
                    <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl">
                      <option value="basic">Basic</option><option value="mixed">Mixed</option><option value="advanced">Advanced</option>
                    </select>
                  </div>
                </div>
                <button type="button" onClick={generateQuestions} disabled={quizContent.length < 100 || uploadProgress.active} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-lg">⚡ Generate Quiz with AI</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GENERATING */}
      {page === 'generating' && (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-12 max-w-lg w-full text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-5xl mx-auto mb-6 animate-pulse">⚡</div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Generating Your Quiz</h2>
            <p className="text-slate-600 mb-2">{generation.step}</p>
            <p className="text-sm text-slate-400 mb-6">Creating {numQuestions} high-quality questions</p>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden mb-2">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${generation.progress}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-slate-500">
              <span>{generation.progress}%</span>
              <span>{generation.progress < 85 ? '⏱️ Usually 30-90 seconds' : 'Almost done...'}</span>
            </div>
            <div className="mt-6 p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500">💡 Tip: More content = better questions. The AI analyzes your material to create questions that test real understanding.</p>
            </div>
          </div>
        </div>
      )}

      {/* REVIEW QUIZ */}
      {page === 'review-quiz' && (
        <div className="min-h-screen bg-slate-100">
          <nav className="bg-white border-b border-slate-200 px-6 py-3 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('landing')}><span className="text-xl">⚡</span><span className="font-bold text-slate-900">QuizForge</span></div>
              <span className={`px-3 py-1 ${userType === 'teacher' ? 'bg-purple-100 text-purple-700' : userType === 'student' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'} text-xs font-medium rounded-full`}>
                {userType === 'teacher' ? '👩‍🏫 Teacher' : userType === 'student' ? '👨‍🎓 Student' : '✨ Creator'}
              </span>
            </div>
          </nav>
          <div className="max-w-5xl mx-auto px-6 py-8">
            <button onClick={() => setPage(getDashboard())} className="text-slate-600 hover:text-slate-900 mb-4 text-sm">← Back to Dashboard</button>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{currentQuiz.published ? '' : 'Review: '}{currentQuiz.name}</h1>
                <p className="text-slate-600">{currentQuiz.questions.length} questions {currentQuiz.published && <span className="text-green-600">• Published ✓</span>}</p>
              </div>
              <div className="flex gap-3">
                {currentQuiz.published ? (
                  <>
                    {userType === 'teacher' && (
                      <button 
                        onClick={() => classes.length > 0 ? setModal({ type: 'select', title: 'Assign Quiz' }) : showToast('Create a class first', 'error')} 
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium"
                      >
                        📨 Assign to Class
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        const selected = shuffleArray([...currentQuiz.questions]).slice(0, 10).map(q => ({ ...q, options: shuffleArray([...q.options]) }));
                        setCurrentQuiz({ ...currentQuiz, questions: selected });
                        setQuizState({ currentQuestion: 0, selectedAnswer: null, answeredQuestions: new Set(), score: 0, results: [] });
                        setPage('take-quiz');
                      }} 
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-lg font-medium"
                    >
                      🎯 Practice
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setQuestionBank(prev => [...prev, ...currentQuiz.questions]); showToast('✅ Added to bank!', 'success'); }} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg">🗃️ Save Only</button>
                    <button onClick={publishQuiz} className="px-5 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium">✓ Publish</button>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-4">
              {currentQuiz.questions.map((q, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">{i + 1}</span>
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-full">{q.topic}</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${q.difficulty === 'Basic' ? 'bg-green-100 text-green-700' : q.difficulty === 'Intermediate' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{q.difficulty}</span>
                  </div>
                  <p className="text-slate-900 font-medium mb-3">{q.question}</p>
                  <div className="grid md:grid-cols-2 gap-2 mb-3">
                    {q.options.map((opt, j) => (
                      <div key={j} className={`px-3 py-2 rounded-lg text-sm ${opt.isCorrect ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-slate-50 text-slate-600'}`}>
                        {String.fromCharCode(65 + j)}) {opt.text} {opt.isCorrect && '✓'}
                      </div>
                    ))}
                  </div>
                  <details className="bg-blue-50 border border-blue-200 rounded-lg">
                    <summary className="px-4 py-2 cursor-pointer text-blue-800 text-sm">📖 Explanation</summary>
                    <div className="px-4 py-3 text-sm text-blue-900 border-t border-blue-200">{q.explanation}</div>
                  </details>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAKE QUIZ */}
      {page === 'take-quiz' && currentQuiz.questions.length > 0 && (() => {
        const q = currentQuiz.questions[quizState.currentQuestion];
        const isAnswered = quizState.answeredQuestions.has(quizState.currentQuestion);
        return (
          <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
            <div className="max-w-3xl mx-auto px-6 py-8">
              <div className="flex items-center justify-between mb-6">
                <button onClick={() => setPage(getDashboard())} className="text-slate-400 hover:text-white">✕ Exit</button>
                <div className="flex items-center gap-4">
                  <span className="text-slate-400 text-sm">{quizState.currentQuestion + 1} / {currentQuiz.questions.length}</span>
                  <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm">Score: {quizState.score}/{quizState.answeredQuestions.size}</span>
                </div>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 mb-8"><div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all" style={{ width: `${((quizState.currentQuestion + 1) / currentQuiz.questions.length) * 100}%` }} /></div>
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-8 mb-6">
                <div className="flex gap-2 mb-4">
                  <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-sm rounded-full">{q.topic}</span>
                  <span className={`px-3 py-1 text-sm rounded-full ${q.difficulty === 'Basic' ? 'bg-green-500/20 text-green-400' : q.difficulty === 'Intermediate' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>{q.difficulty}</span>
                </div>
                <h2 className="text-xl text-white font-medium mb-6">{q.question}</h2>
                <div className="space-y-3">
                  {q.options.map((opt, i) => {
                    let classes = 'bg-slate-800/50 border-slate-600 hover:bg-slate-700/50';
                    if (isAnswered) {
                      if (opt.isCorrect) classes = 'bg-green-500/20 border-green-500';
                      else if (quizState.selectedAnswer === i) classes = 'bg-red-500/20 border-red-500';
                      else classes = 'bg-slate-800/30 border-slate-700 opacity-50';
                    } else if (quizState.selectedAnswer === i) classes = 'bg-indigo-500/20 border-indigo-500';
                    return (
                      <button key={i} onClick={() => selectAnswer(i)} disabled={isAnswered} className={`w-full text-left p-4 rounded-xl border-2 transition ${classes}`}>
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold ${quizState.selectedAnswer === i ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'}`}>{String.fromCharCode(65 + i)}</span>
                          <span className="text-white flex-1">{opt.text}</span>
                          {isAnswered && opt.isCorrect && <span className="text-green-400">✓</span>}
                          {isAnswered && quizState.selectedAnswer === i && !opt.isCorrect && <span className="text-red-400">✗</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {isAnswered && (
                  <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                    <h4 className="text-blue-400 font-medium mb-2">💡 Explanation</h4>
                    <p className="text-slate-300 text-sm">{q.explanation}</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                {!isAnswered ? (
                  <button onClick={checkAnswer} disabled={quizState.selectedAnswer === null} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg">Check Answer</button>
                ) : (
                  <button onClick={nextQuestion} className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg">{quizState.currentQuestion === currentQuiz.questions.length - 1 ? 'See Results' : 'Next →'}</button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* QUIZ RESULTS */}
      {page === 'quiz-results' && (() => {
        const percentage = Math.round((quizState.score / currentQuiz.questions.length) * 100);
        const emoji = percentage >= 80 ? '🏆' : percentage >= 60 ? '📈' : '📚';
        return (
          <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 py-12">
            <div className="max-w-2xl mx-auto px-6">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-12 text-center">
                <div className="text-7xl mb-4">{emoji}</div>
                <h2 className="text-3xl font-bold text-white mb-2">Quiz Complete!</h2>
                <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 mb-2">{quizState.score}/{currentQuiz.questions.length}</div>
                <p className="text-slate-400 mb-8">{percentage}% correct</p>
                <div className="w-full bg-slate-700 rounded-full h-4 mb-8 overflow-hidden"><div className="h-full bg-gradient-to-r from-amber-500 to-orange-500" style={{ width: `${percentage}%` }} /></div>
                <div className="flex gap-3">
                  <button onClick={() => setPage(getDashboard())} className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Dashboard</button>
                  <button onClick={() => {
                    setQuizState({ currentQuestion: 0, selectedAnswer: null, answeredQuestions: new Set(), score: 0, results: [] });
                    setCurrentQuiz(q => ({ ...q, questions: shuffleArray(q.questions.map(qq => ({ ...qq, options: shuffleArray([...qq.options]) }))) }));
                    setPage('take-quiz');
                  }} className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl">Retake</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
