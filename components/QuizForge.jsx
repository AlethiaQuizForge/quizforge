'use client';

import React, { useState, useRef, useEffect } from 'react';
import * as mammoth from 'mammoth';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, GoogleAuthProvider, OAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, updateDoc, addDoc, onSnapshot } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAi6pp6BHnPBbTAqUn78ldOeXO_y6LGouY",
  authDomain: "quizforge-58f79.firebaseapp.com",
  projectId: "quizforge-58f79",
  storageBucket: "quizforge-58f79.firebasestorage.app",
  messagingSenderId: "437296472306",
  appId: "1:437296472306:web:7cee86fa4aa7dbc16c306b"
};

// Initialize Firebase (prevent multiple initializations)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

// Storage helper using Firestore
const storage = {
  async get(key) {
    try {
      const docRef = doc(db, 'userData', key);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { key, value: docSnap.data().value };
      }
      return null;
    } catch (e) {
      console.error('Storage get error:', e);
      return null;
    }
  },
  async set(key, value) {
    try {
      const docRef = doc(db, 'userData', key);
      await setDoc(docRef, { value, updatedAt: new Date() });
      return { key, value };
    } catch (e) {
      console.error('Storage set error for key:', key, 'Error:', e.message, e.code);
      return null;
    }
  },
  async delete(key) {
    try {
      const docRef = doc(db, 'userData', key);
      await deleteDoc(docRef);
      return { key, deleted: true };
    } catch (e) {
      console.error('Storage delete error:', e);
      return null;
    }
  }
};

export default function QuizForge() {
  // Helper for grammar
  const pluralize = (count, word) => count === 1 ? `${count} ${word}` : `${count} ${word}s`;
  
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [socialAuthPending, setSocialAuthPending] = useState(null);
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const [page, setPage] = useState('landing');
  const [userType, setUserType] = useState(null);
  const [userName, setUserName] = useState('');
  
  const [questionBank, setQuestionBank] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [studentProgress, setStudentProgress] = useState({
    quizzesTaken: 0, totalScore: 0, totalQuestions: 0, topicHistory: {}, recentScores: [],
    currentStreak: 0, longestStreak: 0, lastPracticeDate: null,
    achievements: [],
    // For progress charts
    dailyHistory: [], // [{ date: '2026-01-13', quizzes: 2, avgScore: 85 }, ...]
    // For spaced repetition
    questionHistory: {} // { questionId: { lastSeen: timestamp, correctCount: 0, wrongCount: 0, nextReview: timestamp } }
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
  const [topicFocus, setTopicFocus] = useState('');
  const [questionStyle, setQuestionStyle] = useState('concept');
  
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
  const [sharedQuizMode, setSharedQuizMode] = useState(false);
  const [sharedQuizData, setSharedQuizData] = useState(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [quizTagInput, setQuizTagInput] = useState('');
  
  // A+ Features
  const [darkMode, setDarkMode] = useState(false);
  const [timedMode, setTimedMode] = useState(false);
  const [timeLimit, setTimeLimit] = useState(null); // seconds remaining
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [showAnalytics, setShowAnalytics] = useState(null); // quiz id for analytics
  const [showProgressChart, setShowProgressChart] = useState(false);
  
  const fileInputRef = useRef(null);
  const timerRef = useRef(null);

  // Network error helper - wraps async operations with error handling
  const withNetworkRetry = async (operation, errorMessage = 'Network error. Please try again.') => {
    try {
      return await operation();
    } catch (error) {
      console.error('Network operation failed:', error);
      if (error.code === 'unavailable' || error.message?.includes('network') || error.message?.includes('fetch')) {
        showToast('📡 ' + errorMessage + ' Check your internet connection.', 'error');
      } else if (error.code === 'permission-denied') {
        showToast('🔒 Permission denied. Please log in again.', 'error');
      } else {
        showToast('❌ ' + errorMessage, 'error');
      }
      throw error;
    }
  };

  const cancelUpload = () => {
    if (uploadController) {
      uploadController.abort();
    }
    setUploadProgress({ active: false, step: '', progress: 0 });
    showToast('Upload cancelled', 'info');
  };
  
  // Shared quiz checker function
  const checkForSharedQuiz = async () => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get('quiz');
    if (sharedId) {
      try {
        const result = await storage.get(`shared-${sharedId}`);
        if (result && result.value) {
          const quizData = JSON.parse(result.value);
          setSharedQuizData(quizData);
          setSharedQuizMode(true);
          setCurrentQuiz(quizData);
          setQuizState({ currentQuestion: 0, selectedAnswer: null, answeredQuestions: new Set(), score: 0, results: [] });
          setPage('take-quiz');
        } else {
          console.log('Shared quiz not found');
        }
      } catch (err) {
        console.log('Could not load shared quiz:', err);
      }
    }
  };
  
  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Load user profile from Firestore
          const result = await storage.get(`quizforge-account-${firebaseUser.uid}`);
          if (result && result.value) {
            const userData = JSON.parse(result.value);
            setUser(userData);
            setUserName(userData.name);
            setUserType(userData.role);
            setIsLoggedIn(true);
            
            // Load user's data
            const dataResult = await storage.get(`quizforge-data-${firebaseUser.uid}`);
            if (dataResult && dataResult.value) {
              const data = JSON.parse(dataResult.value);
              setQuizzes(data.quizzes || []);
              setJoinedClasses(data.joinedClasses || []);
              setSubmissions(data.submissions || []);
              setQuestionBank(data.questionBank || []);
              setStudentProgress(data.studentProgress || { quizzesTaken: 0, totalScore: 0, totalQuestions: 0, topicHistory: {}, recentScores: [], currentStreak: 0, longestStreak: 0, lastPracticeDate: null, achievements: [], dailyHistory: [], questionHistory: {} });

              // Fetch assignments from Firestore for student's joined classes
              const joinedClassIds = (data.joinedClasses || []).map(c => c.id);
              if (joinedClassIds.length > 0 && userData.role === 'student') {
                try {
                  const assignmentsRef = collection(db, 'assignments');
                  const allAssignments = [];
                  // Fetch assignments for each joined class
                  for (const classId of joinedClassIds) {
                    const assignQ = query(assignmentsRef, where('classId', '==', classId));
                    const assignSnapshot = await getDocs(assignQ);
                    assignSnapshot.docs.forEach(d => {
                      allAssignments.push({ id: d.id, ...d.data() });
                    });
                  }
                  setAssignments(allAssignments);
                } catch (e) {
                  console.log('Error fetching assignments:', e);
                  setAssignments(data.assignments || []);
                }
              } else {
                setAssignments(data.assignments || []);
              }

              // Sync classes from Firestore to get latest student data
              const localClasses = data.classes || [];
              if (localClasses.length > 0) {
                try {
                  const syncedClasses = await Promise.all(
                    localClasses.map(async (cls) => {
                      const classDoc = await getDoc(doc(db, 'classes', cls.id));
                      if (classDoc.exists()) {
                        return { ...cls, ...classDoc.data() };
                      }
                      // If not in Firestore yet, save it
                      await setDoc(doc(db, 'classes', cls.id), {
                        ...cls,
                        teacherId: userData.email,
                        teacherName: userData.name
                      });
                      return cls;
                    })
                  );
                  setClasses(syncedClasses);
                } catch (e) {
                  console.log('Error syncing classes from Firestore:', e);
                  setClasses(localClasses);
                }
              } else {
                setClasses([]);
              }

              // For teachers: fetch submissions from Firestore for their assignments
              if (userData.role === 'teacher') {
                const localAssignments = data.assignments || [];
                if (localAssignments.length > 0) {
                  try {
                    const submissionsRef = collection(db, 'submissions');
                    const allSubmissions = [];
                    for (const assignment of localAssignments) {
                      const subQ = query(submissionsRef, where('assignmentId', '==', assignment.id));
                      const subSnapshot = await getDocs(subQ);
                      subSnapshot.docs.forEach(d => {
                        allSubmissions.push({ id: d.id, ...d.data() });
                      });
                    }
                    // Merge with local submissions, avoiding duplicates
                    const localSubs = data.submissions || [];
                    const mergedSubs = [...localSubs];
                    allSubmissions.forEach(firestoreSub => {
                      if (!mergedSubs.some(s => s.id === firestoreSub.id)) {
                        mergedSubs.push(firestoreSub);
                      }
                    });
                    setSubmissions(mergedSubs);
                  } catch (e) {
                    console.log('Error fetching submissions from Firestore:', e);
                  }
                }
              }
            }
          }
        } catch (err) {
          console.log('Error loading user data:', err);
        }
      } else {
        setUser(null);
        setIsLoggedIn(false);
        setUserType(null);
        setUserName('');
      }
      
      // Check for shared quiz BEFORE finishing loading
      await checkForSharedQuiz();
      setIsLoading(false);
    });
    
    return () => unsubscribe();
  }, []);
  
  // Save data whenever it changes
  useEffect(() => {
    const saveData = async () => {
      if (user && isLoggedIn && auth.currentUser) {
        try {
          await storage.set(`quizforge-data-${auth.currentUser.uid}`, JSON.stringify({
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
  
  // Real-time listener for class roster updates (teachers only)
  useEffect(() => {
    if (!isLoggedIn || userType !== 'teacher' || classes.length === 0) return;

    // Set up listeners for each class the teacher owns
    const unsubscribes = classes.map(cls => {
      return onSnapshot(doc(db, 'classes', cls.id), (docSnapshot) => {
        if (docSnapshot.exists()) {
          const updatedClassData = docSnapshot.data();
          setClasses(prev => prev.map(c =>
            c.id === cls.id ? { ...c, ...updatedClassData } : c
          ));
        }
      }, (error) => {
        console.log('Class listener error:', error);
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [isLoggedIn, userType, classes.length]); // Only re-subscribe when class count changes

  // Real-time listener for submission updates (teachers only)
  useEffect(() => {
    if (!isLoggedIn || userType !== 'teacher' || assignments.length === 0) return;

    const assignmentIds = assignments.map(a => a.id);
    if (assignmentIds.length === 0) return;

    // Listen to submissions collection for teacher's assignments
    const submissionsRef = collection(db, 'submissions');
    const unsubscribes = assignmentIds.map(assignmentId => {
      const q = query(submissionsRef, where('assignmentId', '==', assignmentId));
      return onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const newSub = { id: change.doc.id, ...change.doc.data() };
            setSubmissions(prev => {
              if (prev.some(s => s.id === newSub.id)) return prev;
              return [...prev, newSub];
            });
          }
        });
      }, (error) => {
        console.log('Submissions listener error:', error);
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [isLoggedIn, userType, assignments.length]);

  // Dark mode effect - sync with system and localStorage
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('quizforge-darkmode');
    if (savedDarkMode !== null) {
      setDarkMode(savedDarkMode === 'true');
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }
  }, []);
  
  useEffect(() => {
    localStorage.setItem('quizforge-darkmode', darkMode.toString());
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);
  
  // Timer effect for timed quiz mode
  useEffect(() => {
    if (timedMode && timeLimit > 0 && page === 'take-quiz') {
      timerRef.current = setInterval(() => {
        setTimeLimit(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            // Time's up - auto-submit
            showToast('⏱️ Time is up!', 'error');
            setPage('quiz-results');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [timedMode, page]);
  
  // Check for first-time user (show onboarding)
  useEffect(() => {
    if (isLoggedIn && user && !isLoading) {
      const hasSeenOnboarding = localStorage.getItem(`quizforge-onboarding-${user.email}`);
      if (!hasSeenOnboarding && studentProgress.quizzesTaken === 0) {
        setShowOnboarding(true);
        setOnboardingStep(0);
      }
    }
  }, [isLoggedIn, user, isLoading]);
  
  // Format time for display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handleLogin = async () => {
    setAuthError('');
    if (!authForm.email.trim()) {
      setAuthError('Please enter your email');
      return;
    }
    if (!authForm.password) {
      setAuthError('Please enter your password');
      return;
    }
    
    try {
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, authForm.email.trim(), authForm.password);
      const firebaseUser = userCredential.user;
      
      // Load user profile from Firestore
      const result = await storage.get(`quizforge-account-${firebaseUser.uid}`);
      if (result && result.value) {
        const userData = JSON.parse(result.value);
        setUser(userData);
        setUserName(userData.name);
        setUserType(userData.role);
        setIsLoggedIn(true);

        // Load user's data
        const dataResult = await storage.get(`quizforge-data-${firebaseUser.uid}`);
        if (dataResult && dataResult.value) {
          const data = JSON.parse(dataResult.value);
          setQuizzes(data.quizzes || []);
          setClasses(data.classes || []);
          setJoinedClasses(data.joinedClasses || []);
          setAssignments(data.assignments || []);
          setQuestionBank(data.questionBank || []);
          setStudentProgress(data.studentProgress || { quizzesTaken: 0, totalScore: 0, totalQuestions: 0, topicHistory: {}, recentScores: [], currentStreak: 0, longestStreak: 0, lastPracticeDate: null, achievements: [], dailyHistory: [], questionHistory: {} });

          // For teachers: fetch submissions from Firestore
          if (userData.role === 'teacher') {
            const localAssignments = data.assignments || [];
            if (localAssignments.length > 0) {
              try {
                const submissionsRef = collection(db, 'submissions');
                const allSubmissions = [];
                for (const assignment of localAssignments) {
                  const subQ = query(submissionsRef, where('assignmentId', '==', assignment.id));
                  const subSnapshot = await getDocs(subQ);
                  subSnapshot.docs.forEach(d => {
                    allSubmissions.push({ id: d.id, ...d.data() });
                  });
                }
                const localSubs = data.submissions || [];
                const mergedSubs = [...localSubs];
                allSubmissions.forEach(firestoreSub => {
                  if (!mergedSubs.some(s => s.id === firestoreSub.id)) {
                    mergedSubs.push(firestoreSub);
                  }
                });
                setSubmissions(mergedSubs);
              } catch (e) {
                console.log('Error fetching submissions:', e);
                setSubmissions(data.submissions || []);
              }
            } else {
              setSubmissions(data.submissions || []);
            }
          } else {
            setSubmissions(data.submissions || []);
          }
        }

        showToast(`Welcome back, ${userData.name}!`, 'success');
        setAuthForm({ name: '', email: '', password: '', role: 'student' });
        setPage(userData.role === 'teacher' ? 'teacher-dashboard' : userData.role === 'student' ? 'student-dashboard' : 'creator-dashboard');
      }
    } catch (err) {
      console.error('Login error:', err);
      if (err.code === 'auth/user-not-found') {
        setAuthError('Account not found. Please sign up first.');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setAuthError('Incorrect password. Please try again.');
      } else if (err.code === 'auth/invalid-email') {
        setAuthError('Please enter a valid email address.');
      } else {
        setAuthError('Login failed. Please try again.');
      }
    }
  };
  
  const handleForgotPassword = async () => {
    if (!authForm.email.trim()) {
      setAuthError('Please enter your email address first');
      return;
    }
    if (!authForm.email.includes('@')) {
      setAuthError('Please enter a valid email address');
      return;
    }
    
    try {
      await sendPasswordResetEmail(auth, authForm.email.trim());
      showToast('Password reset email sent! Check your inbox.', 'success');
      setAuthError('');
    } catch (err) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setAuthError('No account found with this email.');
      } else if (err.code === 'auth/invalid-email') {
        setAuthError('Please enter a valid email address.');
      } else {
        setAuthError('Failed to send reset email. Please try again.');
      }
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
    if (!authForm.password) {
      setAuthError('Please enter a password');
      return;
    }
    if (authForm.password.length < 6) {
      setAuthError('Password must be at least 6 characters');
      return;
    }
    
    try {
      // Create user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, authForm.email.trim(), authForm.password);
      const firebaseUser = userCredential.user;
      
      const userData = {
        id: firebaseUser.uid,
        name: authForm.name.trim(),
        email: authForm.email.toLowerCase().trim(),
        role: authForm.role,
        createdAt: Date.now()
      };
      
      // Save user profile to Firestore (no password stored - Firebase handles it)
      await storage.set(`quizforge-account-${firebaseUser.uid}`, JSON.stringify(userData));
      
      setUser(userData);
      setUserName(userData.name);
      setUserType(userData.role);
      setIsLoggedIn(true);
      
      showToast(`Welcome to QuizForge, ${userData.name}!`, 'success');
      setAuthForm({ name: '', email: '', password: '', role: 'student' });
      setPage(userData.role === 'teacher' ? 'teacher-dashboard' : userData.role === 'student' ? 'student-dashboard' : 'creator-dashboard');
    } catch (err) {
      console.error('Signup error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setAuthError('An account with this email already exists. Please log in.');
      } else if (err.code === 'auth/weak-password') {
        setAuthError('Password must be at least 6 characters.');
      } else if (err.code === 'auth/invalid-email') {
        setAuthError('Please enter a valid email address.');
      } else {
        setAuthError('Signup failed. Please try again.');
      }
    }
  };
  
  // Social login handlers
  const handleGoogleSignIn = async (selectedRole = null) => {
    setAuthError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      
      // Check if user already exists
      const existingUser = await storage.get(`quizforge-account-${firebaseUser.uid}`);
      if (existingUser && existingUser.value) {
        // Existing user - log them in
        const userData = JSON.parse(existingUser.value);
        setUser(userData);
        setUserName(userData.name);
        setUserType(userData.role);
        setIsLoggedIn(true);

        // Load user's data
        const dataResult = await storage.get(`quizforge-data-${firebaseUser.uid}`);
        if (dataResult && dataResult.value) {
          const data = JSON.parse(dataResult.value);
          setQuizzes(data.quizzes || []);
          setClasses(data.classes || []);
          setJoinedClasses(data.joinedClasses || []);
          setAssignments(data.assignments || []);
          setQuestionBank(data.questionBank || []);
          setStudentProgress(data.studentProgress || { quizzesTaken: 0, totalScore: 0, totalQuestions: 0, topicHistory: {}, recentScores: [], currentStreak: 0, longestStreak: 0, lastPracticeDate: null, achievements: [], dailyHistory: [], questionHistory: {} });

          // For teachers: fetch submissions from Firestore
          if (userData.role === 'teacher') {
            const localAssignments = data.assignments || [];
            if (localAssignments.length > 0) {
              try {
                const submissionsRef = collection(db, 'submissions');
                const allSubmissions = [];
                for (const assignment of localAssignments) {
                  const subQ = query(submissionsRef, where('assignmentId', '==', assignment.id));
                  const subSnapshot = await getDocs(subQ);
                  subSnapshot.docs.forEach(d => {
                    allSubmissions.push({ id: d.id, ...d.data() });
                  });
                }
                const localSubs = data.submissions || [];
                const mergedSubs = [...localSubs];
                allSubmissions.forEach(firestoreSub => {
                  if (!mergedSubs.some(s => s.id === firestoreSub.id)) {
                    mergedSubs.push(firestoreSub);
                  }
                });
                setSubmissions(mergedSubs);
              } catch (e) {
                console.log('Error fetching submissions:', e);
                setSubmissions(data.submissions || []);
              }
            } else {
              setSubmissions(data.submissions || []);
            }
          } else {
            setSubmissions(data.submissions || []);
          }
        }

        showToast(`Welcome back, ${userData.name}!`, 'success');
        setPage(userData.role === 'teacher' ? 'teacher-dashboard' : userData.role === 'student' ? 'student-dashboard' : 'creator-dashboard');
      } else {
        // New user - need to select role
        if (!selectedRole) {
          setSocialAuthPending({ provider: 'google', user: firebaseUser });
          return;
        }
        
        const userData = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'User',
          email: firebaseUser.email,
          role: selectedRole,
          createdAt: Date.now()
        };
        
        await storage.set(`quizforge-account-${firebaseUser.uid}`, JSON.stringify(userData));
        
        setUser(userData);
        setUserName(userData.name);
        setUserType(userData.role);
        setIsLoggedIn(true);
        setSocialAuthPending(null);
        
        showToast(`Welcome to QuizForge, ${userData.name}!`, 'success');
        setPage(userData.role === 'teacher' ? 'teacher-dashboard' : userData.role === 'student' ? 'student-dashboard' : 'creator-dashboard');
      }
    } catch (err) {
      console.error('Google sign-in error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        return; // User closed popup, no error needed
      }
      setAuthError('Google sign-in failed. Please try again.');
    }
  };
  
  const handleAppleSignIn = async (selectedRole = null) => {
    setAuthError('');
    try {
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      // Check if user already exists
      const existingUser = await storage.get(`quizforge-account-${firebaseUser.uid}`);
      if (existingUser && existingUser.value) {
        // Existing user - log them in
        const userData = JSON.parse(existingUser.value);
        setUser(userData);
        setUserName(userData.name);
        setUserType(userData.role);
        setIsLoggedIn(true);

        // Load user's data
        const dataResult = await storage.get(`quizforge-data-${firebaseUser.uid}`);
        if (dataResult && dataResult.value) {
          const data = JSON.parse(dataResult.value);
          setQuizzes(data.quizzes || []);
          setClasses(data.classes || []);
          setJoinedClasses(data.joinedClasses || []);
          setAssignments(data.assignments || []);
          setQuestionBank(data.questionBank || []);
          setStudentProgress(data.studentProgress || { quizzesTaken: 0, totalScore: 0, totalQuestions: 0, topicHistory: {}, recentScores: [], currentStreak: 0, longestStreak: 0, lastPracticeDate: null, achievements: [], dailyHistory: [], questionHistory: {} });

          // For teachers: fetch submissions from Firestore
          if (userData.role === 'teacher') {
            const localAssignments = data.assignments || [];
            if (localAssignments.length > 0) {
              try {
                const submissionsRef = collection(db, 'submissions');
                const allSubmissions = [];
                for (const assignment of localAssignments) {
                  const subQ = query(submissionsRef, where('assignmentId', '==', assignment.id));
                  const subSnapshot = await getDocs(subQ);
                  subSnapshot.docs.forEach(d => {
                    allSubmissions.push({ id: d.id, ...d.data() });
                  });
                }
                const localSubs = data.submissions || [];
                const mergedSubs = [...localSubs];
                allSubmissions.forEach(firestoreSub => {
                  if (!mergedSubs.some(s => s.id === firestoreSub.id)) {
                    mergedSubs.push(firestoreSub);
                  }
                });
                setSubmissions(mergedSubs);
              } catch (e) {
                console.log('Error fetching submissions:', e);
                setSubmissions(data.submissions || []);
              }
            } else {
              setSubmissions(data.submissions || []);
            }
          } else {
            setSubmissions(data.submissions || []);
          }
        }

        showToast(`Welcome back, ${userData.name}!`, 'success');
        setPage(userData.role === 'teacher' ? 'teacher-dashboard' : userData.role === 'student' ? 'student-dashboard' : 'creator-dashboard');
      } else {
        // New user - need to select role
        if (!selectedRole) {
          setSocialAuthPending({ provider: 'apple', user: firebaseUser });
          return;
        }
        
        const userData = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'User',
          email: firebaseUser.email || 'private@apple.com',
          role: selectedRole,
          createdAt: Date.now()
        };
        
        await storage.set(`quizforge-account-${firebaseUser.uid}`, JSON.stringify(userData));
        
        setUser(userData);
        setUserName(userData.name);
        setUserType(userData.role);
        setIsLoggedIn(true);
        setSocialAuthPending(null);
        
        showToast(`Welcome to QuizForge, ${userData.name}!`, 'success');
        setPage(userData.role === 'teacher' ? 'teacher-dashboard' : userData.role === 'student' ? 'student-dashboard' : 'creator-dashboard');
      }
    } catch (err) {
      console.error('Apple sign-in error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        return;
      }
      setAuthError('Apple sign-in failed. Please try again.');
    }
  };
  
  const completeSocialSignup = async (role) => {
    if (!socialAuthPending) return;
    
    const { provider, user: firebaseUser } = socialAuthPending;
    
    const userData = {
      id: firebaseUser.uid,
      name: firebaseUser.displayName || 'User',
      email: firebaseUser.email || 'private@apple.com',
      role: role,
      createdAt: Date.now()
    };
    
    await storage.set(`quizforge-account-${firebaseUser.uid}`, JSON.stringify(userData));
    
    setUser(userData);
    setUserName(userData.name);
    setUserType(userData.role);
    setIsLoggedIn(true);
    setSocialAuthPending(null);
    
    showToast(`Welcome to QuizForge, ${userData.name}!`, 'success');
    setPage(userData.role === 'teacher' ? 'teacher-dashboard' : userData.role === 'student' ? 'student-dashboard' : 'creator-dashboard');
  };
  
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.log('Could not sign out:', err);
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
    setStudentProgress({ quizzesTaken: 0, totalScore: 0, totalQuestions: 0, topicHistory: {}, recentScores: [], currentStreak: 0, longestStreak: 0, lastPracticeDate: null, achievements: [], dailyHistory: [], questionHistory: {} });
    setAuthForm({ name: '', email: '', password: '', role: 'student' });
    setPage('landing');
    showToast('Logged out successfully', 'info');
  };
  
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  
  // Share quiz function - uses existing shareId to prevent database bloat
  const shareQuiz = async (quiz) => {
    try {
      let shareId = quiz.shareId;
      
      // Only create new share if quiz doesn't have one
      if (!shareId) {
        shareId = `s${Date.now()}`;
        
        const questionsToShare = quiz.questions.length > 50 
          ? quiz.questions.slice(0, 50) 
          : quiz.questions;
        
        if (quiz.questions.length > 50) {
          showToast(`ℹ️ Sharing first 50 of ${quiz.questions.length} questions`, 'info');
        }
        
        const shareData = {
          id: shareId,
          name: quiz.name,
          questions: questionsToShare,
          subject: quiz.subject || 'General',
          createdBy: user?.name || 'Anonymous',
          createdAt: Date.now()
        };
        
        const result = await storage.set(`shared-${shareId}`, JSON.stringify(shareData));
        
        if (!result) {
          showToast('❌ Could not save quiz to database', 'error');
          return null;
        }
        
        // Update quiz with shareId to prevent future duplicates
        const updatedQuiz = { ...quiz, shareId };
        setQuizzes(prev => prev.map(q => q.id === quiz.id ? updatedQuiz : q));
        if (currentQuiz.id === quiz.id) {
          setCurrentQuiz(updatedQuiz);
        }
      }
      
      const shareUrl = `${window.location.origin}?quiz=${shareId}`;
      
      try {
        await navigator.clipboard.writeText(shareUrl);
        showToast('🔗 Share link copied to clipboard!', 'success');
      } catch (clipboardErr) {
        setModalInput(shareUrl);
        setModal('share-link');
      }
      
      return shareId;
    } catch (err) {
      console.error('Share error:', err);
      showToast(`❌ Share failed: ${err.message || 'Unknown error'}`, 'error');
      return null;
    }
  };
  
  // Get or create shareId for a quiz (used by social share buttons)
  const getShareUrl = async (quiz) => {
    // If quiz is already a shared quiz (id starts with 's'), use its id directly
    if (quiz.id && quiz.id.startsWith('s')) {
      return `${window.location.origin}?quiz=${quiz.id}`;
    }

    let shareId = quiz.shareId;

    if (!shareId) {
      shareId = `s${Date.now()}`;

      const shareData = {
        id: shareId,
        name: quiz.name,
        questions: quiz.questions.slice(0, 50),
        subject: quiz.subject || 'General',
        createdBy: user?.name || 'Anonymous',
        createdAt: Date.now(),
        timesTaken: 0
      };

      await storage.set(`shared-${shareId}`, JSON.stringify(shareData));

      // Update quiz with shareId
      const updatedQuiz = { ...quiz, shareId };
      setQuizzes(prev => prev.map(q => q.id === quiz.id ? updatedQuiz : q));
      if (currentQuiz.id === quiz.id) {
        setCurrentQuiz(updatedQuiz);
      }
    }

    return `${window.location.origin}?quiz=${shareId}`;
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

  // Process a single file and return its text content
  const processFile = async (file, fileIndex, totalFiles) => {
    const fileName = file.name.toLowerCase();
    const prefix = totalFiles > 1 ? `[File ${fileIndex + 1}/${totalFiles}] ` : '';
    
    // Text files
    if (file.type === 'text/plain' || fileName.endsWith('.txt')) {
      const text = await file.text();
      return { success: true, text, name: file.name };
    } 
    // Word documents (.docx)
    else if (fileName.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      setUploadProgress({ active: true, step: `${prefix}Reading Word document...`, progress: 30 });
      const arrayBuffer = await file.arrayBuffer();
      setUploadProgress({ active: true, step: `${prefix}Extracting text...`, progress: 60 });
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value.trim();
      if (text.length > 50) {
        return { success: true, text, name: file.name };
      } else {
        return { success: false, error: `${file.name} has little text content` };
      }
    }
    // PDF files
    else if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
      setUploadProgress({ active: true, step: `${prefix}Loading PDF...`, progress: 10 });
      
      const pdfjsLib = await loadPdfJs();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = Math.min(pdf.numPages, 20);
      
      setUploadProgress({ active: true, step: `${prefix}Extracting text from PDF...`, progress: 20 });
      
      let extractedText = '';
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        extractedText += pageText + '\n\n';
        
        const progress = 20 + Math.round((i / numPages) * 60);
        setUploadProgress({ active: true, step: `${prefix}Reading page ${i}/${numPages}...`, progress });
      }
      
      extractedText = extractedText.trim();
      
      if (extractedText.length > 500) {
        return { success: true, text: extractedText, name: file.name };
      } else {
        // Try vision API for image-based PDFs
        setUploadProgress({ active: true, step: `${prefix}PDF is image-based. Using AI vision...`, progress: 70 });
        
        const pageImages = [];
        const maxVisionPages = Math.min(numPages, 10);
        
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
        
        setUploadProgress({ active: true, step: `${prefix}AI analyzing images...`, progress: 80 });
        
        const controller = new AbortController();
        setUploadController(controller);
        
        // Use server-side API route for vision (keeps API key secure)
        const response = await fetch('/api/vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ images: pageImages })
        });
        
        setUploadController(null);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Vision API error for ${file.name}`);
        }
        
        const data = await response.json();
        const visionText = data.text || '';
        
        if (visionText.length > 200) {
          return { success: true, text: visionText, name: file.name };
        }
        return { success: false, error: `Could not extract text from ${file.name}` };
      }
    }
    // PowerPoint files (.pptx) - use JSZip to extract text
    else if (fileName.endsWith('.pptx') || file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      setUploadProgress({ active: true, step: `${prefix}Reading PowerPoint...`, progress: 20 });
      
      try {
        // Dynamically load JSZip
        const JSZip = (await import('jszip')).default;
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        setUploadProgress({ active: true, step: `${prefix}Extracting slides...`, progress: 50 });
        
        let allText = '';
        const slideFiles = Object.keys(zip.files).filter(name => name.match(/ppt\/slides\/slide\d+\.xml/)).sort();
        
        for (let i = 0; i < slideFiles.length; i++) {
          const slideXml = await zip.file(slideFiles[i]).async('string');
          // Extract text from XML (basic extraction)
          const textMatches = slideXml.match(/<a:t>([^<]*)<\/a:t>/g) || [];
          const slideText = textMatches.map(m => m.replace(/<\/?a:t>/g, '')).join(' ');
          if (slideText.trim()) {
            allText += `\n--- Slide ${i + 1} ---\n${slideText.trim()}\n`;
          }
        }
        
        setUploadProgress({ active: true, step: `${prefix}Complete!`, progress: 100 });
        
        if (allText.length > 100) {
          return { success: true, text: allText.trim(), name: file.name };
        } else {
          return { success: false, error: `${file.name} has little text content` };
        }
      } catch (err) {
        console.error('PPTX error:', err);
        return { success: false, error: `Could not read ${file.name}` };
      }
    }
    return { success: false, error: `Unsupported file type: ${file.name}` };
  };

  const handleFileUpload = async (event) => {
    const files = event.target.files || event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    
    const fileArray = Array.from(files).filter(f => {
      const name = f.name.toLowerCase();
      return name.endsWith('.txt') || name.endsWith('.docx') || name.endsWith('.pdf') || name.endsWith('.pptx');
    });
    
    if (fileArray.length === 0) {
      showToast('⚠️ Please use .pdf, .docx, .pptx, or .txt files', 'error');
      return;
    }
    
    setUploadProgress({ active: true, step: `Processing ${fileArray.length} file(s)...`, progress: 5 });
    
    try {
      const results = [];
      for (let i = 0; i < fileArray.length; i++) {
        const result = await processFile(fileArray[i], i, fileArray.length);
        results.push(result);
      }
      
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      if (successful.length > 0) {
        // Combine all text with file markers
        const combinedText = successful.map(r => 
          successful.length > 1 ? `\n--- ${r.name} ---\n${r.text}` : r.text
        ).join('\n\n');
        
        setQuizContent(prev => prev ? prev + '\n\n' + combinedText : combinedText);
        setUploadProgress({ active: true, step: '✅ Complete!', progress: 100 });
        setTimeout(() => setUploadProgress({ active: false, step: '', progress: 0 }), 500);
        
        const totalChars = successful.reduce((sum, r) => sum + r.text.length, 0);
        showToast(`✅ Loaded ${successful.length} file(s) (${totalChars.toLocaleString()} chars)`, 'success');
        
        if (failed.length > 0) {
          setTimeout(() => showToast(`⚠️ ${failed.length} file(s) failed`, 'error'), 1500);
        }
      } else {
        setUploadProgress({ active: false, step: '', progress: 0 });
        showToast('⚠️ Could not extract text from files', 'error');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setUploadProgress({ active: false, step: '', progress: 0 });
      setUploadController(null);
      if (err.name === 'AbortError') {
        showToast('Upload cancelled', 'info');
      } else {
        showToast('⚠️ ' + err.message, 'error');
      }
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileUpload(e);
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

      const questionStyleInstructions = {
        'concept': `IMPORTANT - CONCEPT-FOCUSED QUESTIONS:
- Extract and test the UNDERLYING THEORIES, FRAMEWORKS, and CONCEPTS from the material
- Do NOT ask about specific company names, dates, or case study details
- Convert case examples into general principle questions
- Example: Instead of "What did Company X do in 2021?", ask "What strategic principle does this scenario illustrate?"
- Focus on transferable knowledge that applies beyond specific examples`,
        'case': `CASE-BASED QUESTIONS:
- Test specific details from the cases and examples provided
- Include company names, dates, and specific outcomes
- Ask about what happened in particular scenarios`,
        'mixed': `MIX OF CONCEPT AND CASE QUESTIONS:
- 70% concept-focused questions about underlying theories and frameworks
- 30% case-based questions about specific examples`
      };

      const topicFocusInstruction = topicFocus.trim() 
        ? `\n## TOPIC FOCUS: Focus ONLY on content related to: ${topicFocus.trim()}. Ignore any content not related to this topic.`
        : '';

      setGeneration(g => ({ ...g, step: 'Building quiz prompt...', progress: 10 }));

      const prompt = `You are an expert educational assessment designer.

## INSTRUCTIONS:
1. Test understanding, not just recall.
2. Create plausible distractors.
3. Write helpful explanations.

## QUESTION STYLE:
${questionStyleInstructions[questionStyle]}

## DIFFICULTY: ${difficultyInstructions[difficulty]}
## SUBJECT: ${quizSubject || 'Determine from content'}${topicFocusInstruction}

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
          difficulty,
          topicFocus: topicFocus.trim(),
          questionStyle
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
      
      const newQuiz = {
        id: `quiz_${Date.now()}`,
        name: quizNameInput || 'Generated Quiz',
        questions: shuffleArray(questions),
        subject: quizSubject || 'General',
        published: true,
        createdAt: Date.now()
      };
      
      // Auto-save quiz immediately
      setCurrentQuiz(newQuiz);
      setQuizzes(prev => [...prev, newQuiz]);
      setQuestionBank(prev => [...prev, ...questions]);

      showToast(`✅ Generated ${questions.length} questions!`, 'success');
      
      // Clear form
      setQuizContent('');
      setQuizSubject('');
      setQuizNameInput('');
      
      // Navigate to dashboard first, then show modal
      setPage(getDashboard());
      
      // Show options modal
      setModal({
        type: 'quiz-created',
        quiz: newQuiz
      });

    } catch (error) {
      clearInterval(progressInterval);
      setGeneration({ isGenerating: false, step: '', progress: 0, error: error.message });
      setPage('create-quiz');
      showToast(`❌ Error: ${error.message}`, 'error');
    }
  };

  const createClass = async () => {
    if (!modalInput.trim()) {
      showToast('⚠️ Please enter a class name', 'error');
      return;
    }
    const newClass = {
      id: `class_${Date.now()}`,
      name: modalInput.trim(),
      code: generateClassCode(),
      students: [],
      createdAt: Date.now(),
      teacherId: user?.email || 'unknown',
      teacherName: user?.name || 'Unknown Teacher'
    };

    // Save to global classes collection for cross-user lookup
    try {
      await setDoc(doc(db, 'classes', newClass.id), newClass);
    } catch (e) {
      console.error('Error saving class to Firestore:', e);
    }

    setClasses(prev => [...prev, newClass]);
    setCurrentClass(newClass);
    showToast(`✅ Class "${newClass.name}" created! Code: ${newClass.code}`, 'success');
    setModal(null);
    setModalInput('');
  };

  const joinClass = async () => {
    setIsActionLoading(true);
    const code = joinCodeInput.toUpperCase().trim();
    if (!code) {
      showToast('⚠️ Please enter a class code', 'error');
      setIsActionLoading(false);
      return;
    }
    if (!user?.name) {
      showToast('⚠️ Please log in first', 'error');
      setIsActionLoading(false);
      return;
    }

    // Check if already joined locally first
    const alreadyJoined = joinedClasses.find(c => c.code === code);
    if (alreadyJoined) {
      showToast('ℹ️ You already joined this class', 'info');
      setIsActionLoading(false);
      return;
    }

    // Query Firestore for the class code
    try {
      const classesRef = collection(db, 'classes');
      const q = query(classesRef, where('code', '==', code));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const classDoc = querySnapshot.docs[0];
        const foundClass = { id: classDoc.id, ...classDoc.data() };

        // Add student to the class
        const studentName = user.name;
        const studentEmail = user.email;
        const newStudent = { id: `s_${Date.now()}`, name: studentName, email: studentEmail, joinedAt: Date.now() };
        const updatedStudents = [...(foundClass.students || []), newStudent];

        // Update in Firestore
        await updateDoc(doc(db, 'classes', foundClass.id), { students: updatedStudents });

        // Fetch assignments for this class
        const assignmentsRef = collection(db, 'assignments');
        const assignQ = query(assignmentsRef, where('classId', '==', foundClass.id));
        const assignSnapshot = await getDocs(assignQ);
        const classAssignments = assignSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // Update local state
        const updatedClass = { ...foundClass, students: updatedStudents };
        setJoinedClasses(prev => [...prev, updatedClass]);
        if (classAssignments.length > 0) {
          setAssignments(prev => [...prev, ...classAssignments]);
        }
        showToast(`✅ Joined "${foundClass.name}" by ${foundClass.teacherName || 'teacher'}!`, 'success');
        setJoinCodeInput('');
      } else {
        showToast('❌ Invalid class code. Check with your teacher.', 'error');
      }
    } catch (e) {
      console.error('Error joining class:', e);
      if (e.code === 'unavailable' || e.message?.includes('network') || e.message?.includes('offline')) {
        showToast('📡 Network error. Check your connection and try again.', 'error');
      } else {
        showToast('❌ Error joining class. Please try again.', 'error');
      }
    }

    setIsActionLoading(false);
  };

  // Leave class function
  const leaveClass = async (classId) => {
    setIsActionLoading(true);
    const classToLeave = joinedClasses.find(c => c.id === classId);
    if (classToLeave) {
      // Remove student from class
      const updatedStudents = (classToLeave.students || []).filter(s => s.email !== user?.email && s.name !== user?.name);

      // Update in Firestore
      try {
        await updateDoc(doc(db, 'classes', classId), { students: updatedStudents });
      } catch (e) {
        console.error('Error updating class in Firestore:', e);
      }

      // Update local state
      setClasses(prev => prev.map(c => c.id === classId ? { ...c, students: updatedStudents } : c));
      setJoinedClasses(prev => prev.filter(c => c.id !== classId));
      showToast(`Left "${classToLeave.name}"`, 'info');
    }
    setIsActionLoading(false);
    setModal(null);
  };

  // Duplicate quiz function
  const duplicateQuiz = (quiz) => {
    const newQuiz = {
      ...quiz,
      id: `q${Date.now()}`,
      name: `${quiz.name} (Copy)`,
      shareId: null, // Reset shareId for new quiz
      createdAt: Date.now()
    };
    setQuizzes(prev => [...prev, newQuiz]);
    showToast(`✅ Quiz duplicated!`, 'success');
    setModal(null);
  };

  // Edit quiz question
  const saveQuestionEdit = (quizId, questionIndex, updatedQuestion) => {
    setQuizzes(prev => prev.map(q => {
      if (q.id === quizId) {
        const newQuestions = [...q.questions];
        newQuestions[questionIndex] = updatedQuestion;
        return { ...q, questions: newQuestions, shareId: null }; // Reset shareId on edit
      }
      return q;
    }));
    if (currentQuiz.id === quizId) {
      setCurrentQuiz(prev => {
        const newQuestions = [...prev.questions];
        newQuestions[questionIndex] = updatedQuestion;
        return { ...prev, questions: newQuestions, shareId: null };
      });
    }
    setEditingQuestion(null);
    showToast('✅ Question updated!', 'success');
  };

  // Delete question from quiz
  const deleteQuestion = (quizId, questionIndex) => {
    setQuizzes(prev => prev.map(q => {
      if (q.id === quizId) {
        const newQuestions = q.questions.filter((_, i) => i !== questionIndex);
        return { ...q, questions: newQuestions, shareId: null };
      }
      return q;
    }));
    if (currentQuiz.id === quizId) {
      setCurrentQuiz(prev => ({
        ...prev,
        questions: prev.questions.filter((_, i) => i !== questionIndex),
        shareId: null
      }));
    }
    showToast('Question deleted', 'info');
  };

  // Achievement definitions
  const ACHIEVEMENTS = [
    { id: 'first_quiz', name: '🎯 First Quiz', description: 'Complete your first quiz', check: (p) => p.quizzesTaken >= 1 },
    { id: 'streak_3', name: '🔥 On Fire', description: '3 day practice streak', check: (p) => p.currentStreak >= 3 },
    { id: 'streak_7', name: '⚡ Week Warrior', description: '7 day practice streak', check: (p) => p.currentStreak >= 7 },
    { id: 'quiz_10', name: '📚 Dedicated Learner', description: 'Complete 10 quizzes', check: (p) => p.quizzesTaken >= 10 },
    { id: 'quiz_50', name: '🏆 Quiz Master', description: 'Complete 50 quizzes', check: (p) => p.quizzesTaken >= 50 },
    { id: 'perfect_score', name: '💯 Perfect!', description: 'Get 100% on a quiz', check: (p, score, total) => score === total },
    { id: 'high_avg', name: '⭐ Star Student', description: 'Maintain 80%+ average', check: (p) => p.totalQuestions > 0 && (p.totalScore / p.totalQuestions) >= 0.8 }
  ];

  // Check and award achievements
  const checkAchievements = (progress, score = 0, total = 0) => {
    const newAchievements = [];
    ACHIEVEMENTS.forEach(a => {
      if (!progress.achievements?.includes(a.id) && a.check(progress, score, total)) {
        newAchievements.push(a.id);
        showToast(`🏆 Achievement: ${a.name}!`, 'success');
      }
    });
    return [...(progress.achievements || []), ...newAchievements];
  };

  // Update practice streak
  const updateStreak = (progress) => {
    const today = new Date().toDateString();
    const lastPractice = progress.lastPracticeDate ? new Date(progress.lastPracticeDate).toDateString() : null;
    
    if (lastPractice === today) {
      return progress; // Already practiced today
    }
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isConsecutive = lastPractice === yesterday.toDateString();
    
    const newStreak = isConsecutive ? progress.currentStreak + 1 : 1;
    const longestStreak = Math.max(progress.longestStreak || 0, newStreak);
    
    return {
      ...progress,
      currentStreak: newStreak,
      longestStreak,
      lastPracticeDate: Date.now()
    };
  };

  // Limit question bank size (keep most recent 500)
  const limitQuestionBank = (questions) => {
    if (questions.length > 500) {
      return questions.slice(-500);
    }
    return questions;
  };

  // ============ A+ FEATURES ============
  
  // Spaced Repetition: Calculate next review time based on performance
  const calculateNextReview = (correctCount, wrongCount) => {
    const ratio = correctCount / Math.max(1, correctCount + wrongCount);
    // If getting it right consistently, space out reviews more
    const daysUntilReview = ratio > 0.8 ? 7 : ratio > 0.6 ? 3 : ratio > 0.4 ? 1 : 0.5;
    return Date.now() + (daysUntilReview * 24 * 60 * 60 * 1000);
  };
  
  // Update spaced repetition data for a question
  const updateQuestionHistory = (questionId, wasCorrect) => {
    setStudentProgress(prev => {
      const history = { ...prev.questionHistory };
      const existing = history[questionId] || { correctCount: 0, wrongCount: 0, lastSeen: 0 };
      history[questionId] = {
        lastSeen: Date.now(),
        correctCount: existing.correctCount + (wasCorrect ? 1 : 0),
        wrongCount: existing.wrongCount + (wasCorrect ? 0 : 1),
        nextReview: calculateNextReview(
          existing.correctCount + (wasCorrect ? 1 : 0),
          existing.wrongCount + (wasCorrect ? 0 : 1)
        )
      };
      return { ...prev, questionHistory: history };
    });
  };
  
  // Get questions due for review (spaced repetition)
  const getQuestionsForReview = () => {
    const now = Date.now();
    const history = studentProgress.questionHistory || {};
    return questionBank.filter(q => {
      const qHistory = history[q.id];
      if (!qHistory) return true; // Never seen - should review
      return qHistory.nextReview <= now;
    });
  };
  
  // Start spaced repetition practice
  const startSpacedPractice = () => {
    const dueQuestions = getQuestionsForReview();
    if (dueQuestions.length === 0) {
      showToast('🎉 No questions due for review! Great job keeping up!', 'success');
      return;
    }
    const selected = shuffleArray(dueQuestions).slice(0, Math.min(10, dueQuestions.length))
      .map(q => ({ ...q, options: shuffleArray([...q.options]) }));
    setCurrentQuiz({ id: `review_${Date.now()}`, name: 'Spaced Repetition Review', questions: selected, isSpacedRepetition: true });
    setQuizState({ currentQuestion: 0, selectedAnswer: null, answeredQuestions: new Set(), score: 0, results: [] });
    setPage('take-quiz');
  };
  
  // Update daily history for progress charts
  const updateDailyHistory = (score, total) => {
    const today = new Date().toISOString().split('T')[0];
    setStudentProgress(prev => {
      const history = [...(prev.dailyHistory || [])];
      const todayIndex = history.findIndex(h => h.date === today);
      
      if (todayIndex >= 0) {
        // Update today's entry
        const existing = history[todayIndex];
        const newTotal = existing.quizzes + 1;
        const newAvg = Math.round(((existing.avgScore * existing.quizzes) + Math.round((score / total) * 100)) / newTotal);
        history[todayIndex] = { date: today, quizzes: newTotal, avgScore: newAvg };
      } else {
        // Add new entry for today
        history.push({ date: today, quizzes: 1, avgScore: Math.round((score / total) * 100) });
      }
      
      // Keep last 30 days
      return { ...prev, dailyHistory: history.slice(-30) };
    });
  };
  
  // Quiz Analytics: Calculate question difficulty based on student performance
  const getQuizAnalytics = (quizId) => {
    const quiz = quizzes.find(q => q.id === quizId);
    if (!quiz) return null;
    
    // Get all submissions for this quiz
    const quizAssignments = assignments.filter(a => a.quizId === quizId);
    const quizSubmissions = submissions.filter(s => quizAssignments.some(a => a.id === s.assignmentId));
    
    if (quizSubmissions.length === 0) {
      return { quiz, submissions: 0, questions: quiz.questions.map(q => ({ ...q, correctRate: null, attempts: 0 })) };
    }
    
    // Calculate per-question stats
    const questionStats = quiz.questions.map((q, i) => {
      let correct = 0;
      let total = 0;
      
      quizSubmissions.forEach(sub => {
        if (sub.answers && sub.answers[i]) {
          total++;
          if (sub.answers[i].correct) correct++;
        }
      });
      
      return {
        ...q,
        questionIndex: i,
        attempts: total,
        correctRate: total > 0 ? Math.round((correct / total) * 100) : null
      };
    });
    
    // Sort by difficulty (lowest correct rate = hardest)
    const hardestQuestions = [...questionStats]
      .filter(q => q.correctRate !== null)
      .sort((a, b) => a.correctRate - b.correctRate)
      .slice(0, 5);
    
    const avgScore = quizSubmissions.length > 0 
      ? Math.round(quizSubmissions.reduce((sum, s) => sum + s.percentage, 0) / quizSubmissions.length)
      : 0;
    
    return {
      quiz,
      submissions: quizSubmissions.length,
      avgScore,
      questions: questionStats,
      hardestQuestions
    };
  };
  
  // Complete onboarding
  const completeOnboarding = () => {
    if (user?.email) {
      localStorage.setItem(`quizforge-onboarding-${user.email}`, 'true');
    }
    setShowOnboarding(false);
    setOnboardingStep(0);
  };
  
  // Start timed quiz
  const startTimedQuiz = (quiz, minutes = 10) => {
    const shuffledQuestions = shuffleArray([...quiz.questions])
      .slice(0, Math.min(quiz.questions.length, 20))
      .map(q => ({ ...q, options: shuffleArray([...q.options]) }));
    
    setCurrentQuiz({ ...quiz, questions: shuffledQuestions });
    setQuizState({ currentQuestion: 0, selectedAnswer: null, answeredQuestions: new Set(), score: 0, results: [] });
    setTimedMode(true);
    setTimeLimit(minutes * 60);
    setPage('take-quiz');
  };
  
  // Stop timer when leaving quiz
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setTimedMode(false);
    setTimeLimit(null);
  };

  // ============ END A+ FEATURES ============

  const assignQuiz = async (quizId, weight = 10, dueDate = null) => {
    if (!currentClass && classes.length > 0) {
      setCurrentClass(classes[0]);
    }
    if (!currentClass && classes.length === 0) {
      showToast('⚠️ Create a class first!', 'error');
      setModal(null);
      return;
    }
    const targetClass = currentClass || classes[0];
    const quiz = quizzes.find(q => q.id === quizId);

    const newAssignment = {
      id: `assign_${Date.now()}`,
      quizId,
      classId: targetClass.id,
      className: targetClass.name,
      quizName: quiz?.name || 'Quiz',
      quizQuestions: quiz?.questions || [],
      weight: parseFloat(weight) || 10,
      dueDate: dueDate || null,
      createdAt: Date.now(),
      teacherId: user?.email,
      teacherName: user?.name
    };

    // Save assignment to Firestore for students to access
    try {
      await setDoc(doc(db, 'assignments', newAssignment.id), newAssignment);
      setAssignments(prev => [...prev, newAssignment]);
      showToast(`✅ "${quiz?.name}" assigned to ${targetClass.name}!`, 'success');
    } catch (e) {
      console.error('Error saving assignment to Firestore:', e);
      if (e.code === 'unavailable' || e.message?.includes('network')) {
        showToast('📡 Network error. Assignment saved locally but may not sync to students.', 'error');
        setAssignments(prev => [...prev, newAssignment]); // Still save locally
      } else {
        showToast('❌ Error assigning quiz. Please try again.', 'error');
        return;
      }
    }
    setModal(null);
    setModalInput('');
  };

  const submitQuizResult = async (assignmentId, score, total, answers) => {
    const submission = {
      id: `sub_${Date.now()}`,
      assignmentId,
      studentId: auth.currentUser?.uid || null,
      studentEmail: user?.email || null,
      studentName: user?.name || 'Student',
      score,
      total,
      percentage: Math.round((score / total) * 100),
      answers,
      submittedAt: Date.now()
    };
    setSubmissions(prev => [...prev, submission]);

    // Save to Firestore for teachers to access
    try {
      await setDoc(doc(db, 'submissions', submission.id), submission);
    } catch (e) {
      console.error('Error saving submission to Firestore:', e);
      // Don't show error to student - their result is saved locally
      // Teacher will see it when network is restored
    }
  };

  const selectAnswer = (index) => {
    if (!quizState.answeredQuestions.has(quizState.currentQuestion)) {
      setQuizState(s => ({ ...s, selectedAnswer: index }));
    }
  };

  // Cute affirmations for correct answers (shows ~30% of the time)
  const affirmations = [
    "You're beautiful 💕",
    "Legend! 🏆", 
    "Yes babe! 🔥",
    "Smartie pants! 🧠",
    "You got this! 💪",
    "Killing it! ⚡",
    "Brilliant! ✨",
    "On fire! 🔥",
    "Genius mode! 🎯",
    "Slay! 👑"
  ];

  const checkAnswer = () => {
    if (quizState.selectedAnswer === null) return;
    const q = currentQuiz.questions[quizState.currentQuestion];
    const isCorrect = q.options[quizState.selectedAnswer].isCorrect;
    
    const newAnswered = new Set(quizState.answeredQuestions);
    newAnswered.add(quizState.currentQuestion);
    
    const newResults = [...quizState.results];
    newResults[quizState.currentQuestion] = { correct: isCorrect, selected: quizState.selectedAnswer };
    
    setQuizState(s => ({ ...s, score: isCorrect ? s.score + 1 : s.score, answeredQuestions: newAnswered, results: newResults }));
    
    // Random affirmation ~30% of the time on correct answers
    if (isCorrect && Math.random() < 0.3) {
      const affirmation = affirmations[Math.floor(Math.random() * affirmations.length)];
      showToast(affirmation, 'success');
    }
    
    setStudentProgress(p => {
      const newHistory = { ...p.topicHistory };
      if (!newHistory[q.topic]) newHistory[q.topic] = { correct: 0, total: 0 };
      newHistory[q.topic].total++;
      if (isCorrect) newHistory[q.topic].correct++;
      return { ...p, totalQuestions: p.totalQuestions + 1, totalScore: p.totalScore + (isCorrect ? 1 : 0), topicHistory: newHistory };
    });
  };

  const nextQuestion = async () => {
    if (quizState.currentQuestion < currentQuiz.questions.length - 1) {
      setQuizState(s => ({ ...s, currentQuestion: s.currentQuestion + 1, selectedAnswer: null }));
    } else {
      // Quiz completed - update progress with streak and achievements
      const score = quizState.score;
      const total = currentQuiz.questions.length;
      
      // Stop timer if timed mode
      stopTimer();
      
      // Update spaced repetition data for each question
      quizState.results.forEach((result, i) => {
        const question = currentQuiz.questions[i];
        if (question?.id) {
          updateQuestionHistory(question.id, result.correct);
        }
      });
      
      // Update daily history for progress charts
      updateDailyHistory(score, total);
      
      setStudentProgress(p => {
        // Update streak
        let updatedProgress = updateStreak(p);
        
        // Update stats
        updatedProgress = {
          ...updatedProgress,
          quizzesTaken: updatedProgress.quizzesTaken + 1,
          totalScore: updatedProgress.totalScore + score,
          totalQuestions: updatedProgress.totalQuestions + total,
          recentScores: [...updatedProgress.recentScores.slice(-7), Math.round((score / total) * 100)]
        };
        
        // Check achievements
        updatedProgress.achievements = checkAchievements(updatedProgress, score, total);
        
        return updatedProgress;
      });
      
      if (currentAssignment) {
        submitQuizResult(currentAssignment.id, score, total, quizState.results);
        setCurrentAssignment(null);
      }

      // Increment times taken and update leaderboard for shared quizzes
      if (currentQuiz.id && currentQuiz.id.startsWith('s')) {
        try {
          const result = await storage.get(`shared-${currentQuiz.id}`);
          if (result && result.value) {
            const sharedData = JSON.parse(result.value);
            sharedData.timesTaken = (sharedData.timesTaken || 0) + 1;

            // Update leaderboard (top 10 scores)
            const playerName = user?.name || 'Anonymous';
            const playerScore = Math.round((score / total) * 100);
            const leaderboard = sharedData.leaderboard || [];
            const newEntry = { name: playerName, score: playerScore, date: Date.now() };

            // Add new entry and keep top 10
            leaderboard.push(newEntry);
            leaderboard.sort((a, b) => b.score - a.score || a.date - b.date);
            sharedData.leaderboard = leaderboard.slice(0, 10);

            await storage.set(`shared-${currentQuiz.id}`, JSON.stringify(sharedData));
            // Update local state so UI shows updated count and leaderboard
            setSharedQuizData(sharedData);
            setCurrentQuiz(q => ({ ...q, timesTaken: sharedData.timesTaken, leaderboard: sharedData.leaderboard }));
          }
        } catch (e) {
          console.log('Could not update times taken:', e);
        }
      }

      setPage('quiz-results');
    }
  };

  const publishQuiz = () => {
    const published = { ...currentQuiz, published: true, tags: quizTagInput ? quizTagInput.split(',').map(t => t.trim()).filter(t => t) : [] };
    setQuizzes(prev => [...prev, published]);
    setQuestionBank(prev => limitQuestionBank([...prev, ...currentQuiz.questions]));
    
    // Clear quiz form for next quiz
    setQuizContent('');
    setQuizSubject('');
    setQuizNameInput('');
    setNumQuestions(10);
    setDifficulty('mixed');
    setTopicFocus('');
    setQuestionStyle('concept');
    setQuizTagInput('');
    
    showToast('✅ Quiz published!', 'success');
    
    // Show next steps modal
    setModal({
      type: 'next-steps',
      title: '🎉 Quiz Published!',
      quizName: published.name,
      questionCount: published.questions.length
    });
  };
  
  const deleteQuiz = (quizId) => {
    setIsActionLoading(true);
    setQuizzes(prev => prev.filter(q => q.id !== quizId));
    showToast('🗑️ Quiz deleted', 'info');
    setModal(null);
    setIsActionLoading(false);
  };

  // Retry only wrong answers
  const retryWrongAnswers = () => {
    const wrongQuestions = quizState.results
      .map((r, i) => ({ ...currentQuiz.questions[i], wasWrong: !r.correct }))
      .filter(q => q.wasWrong)
      .map(q => ({ ...q, options: shuffleArray([...q.options]) }));
    
    if (wrongQuestions.length === 0) {
      showToast('🎉 No wrong answers to retry!', 'success');
      return;
    }
    
    setCurrentQuiz(prev => ({ ...prev, questions: wrongQuestions }));
    setQuizState({ currentQuestion: 0, selectedAnswer: null, answeredQuestions: new Set(), score: 0, results: [] });
    setPage('take-quiz');
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
    // Try local quiz first, then use assignment's embedded quiz data
    const localQuiz = quizzes.find(q => q.id === assignment.quizId);
    const quizQuestions = assignment.quizQuestions || localQuiz?.questions || [];
    const quizName = assignment.quizName || localQuiz?.name || 'Quiz';

    if (!quizQuestions.length) {
      showToast('Quiz not found', 'error');
      return;
    }

    setCurrentQuiz({
      id: assignment.quizId,
      name: quizName,
      questions: quizQuestions.map(q => ({ ...q, options: shuffleArray([...q.options]) }))
    });
    setCurrentAssignment(assignment);
    setQuizState({ currentQuestion: 0, selectedAnswer: null, answeredQuestions: new Set(), score: 0, results: [] });
    setPage('take-quiz');
  };

  const resetData = async () => {
    setQuestionBank([]); setQuizzes([]); setClasses([]); setJoinedClasses([]); setAssignments([]); setSubmissions([]);
    setStudentProgress({ quizzesTaken: 0, totalScore: 0, totalQuestions: 0, topicHistory: {}, recentScores: [], currentStreak: 0, longestStreak: 0, lastPracticeDate: null, achievements: [] });
    setQuizContent(''); setQuizSubject(''); setQuizNameInput(''); setJoinCodeInput(''); setQuizTagInput('');
    setCurrentClass(null); setCurrentQuiz({ id: null, name: '', questions: [], published: false });
    
    // Clear saved data
    if (auth.currentUser) {
      try {
        await storage.delete(`quizforge-data-${auth.currentUser.uid}`);
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
  const pendingAssignments = assignments.filter(a => joinedClasses.some(c => c.id === a.classId) && !submissions.some(s => s.assignmentId === a.id && (s.studentId === auth.currentUser?.uid || s.studentEmail === user?.email)));
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

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">⚡</div>
          <p className="text-white/60">Loading QuizForge...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-slate-900' : ''}`}>
      {/* Dark Mode Toggle - Fixed position */}
      <button 
        onClick={() => setDarkMode(!darkMode)}
        className="fixed bottom-6 left-6 z-50 p-3 bg-slate-800 dark:bg-white text-white dark:text-slate-900 rounded-full shadow-lg hover:scale-110 transition-transform"
        title={darkMode ? 'Light Mode' : 'Dark Mode'}
      >
        {darkMode ? '☀️' : '🌙'}
      </button>
      
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-indigo-600'} text-white px-6 py-3 rounded-xl shadow-lg z-50`}>
          {toast.message}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setModal(null); setModalInput(''); }}>
          <div className={`bg-white rounded-2xl p-6 w-full mx-4 shadow-2xl ${modal?.type === 'review-answers' ? 'max-w-3xl max-h-[80vh] overflow-y-auto' : 'max-w-md'}`} onClick={e => e.stopPropagation()}>
            {modal?.title && <h3 className="text-lg font-semibold mb-4">{modal.title}</h3>}
            
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
            
            {/* Select Quiz Modal - with weight and due date */}
            {modal.type === 'select' && (
              <>
                {!modal.selectedQuiz ? (
                  <>
                    <p className="text-sm text-slate-600 mb-3">Select a quiz to assign:</p>
                    <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                      {quizzes.length > 0 ? quizzes.map(quiz => (
                        <button 
                          key={quiz.id} 
                          onClick={() => setModal({ ...modal, selectedQuiz: quiz, weight: 10, dueDate: '' })} 
                          className="w-full p-3 text-left bg-slate-50 hover:bg-indigo-50 rounded-lg border border-slate-200"
                        >
                          <p className="font-medium">{quiz.name}</p>
                          <p className="text-sm text-slate-500">{pluralize(quiz.questions.length, 'question')}</p>
                        </button>
                      )) : (
                        <p className="text-slate-500 text-center py-4">No quizzes available. Create one first!</p>
                      )}
                    </div>
                    <button onClick={() => { setModal(null); setModalInput(''); }} className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg">Cancel</button>
                  </>
                ) : (
                  <>
                    <div className="bg-indigo-50 rounded-lg p-3 mb-4">
                      <p className="font-medium text-indigo-900">{modal.selectedQuiz.name}</p>
                      <p className="text-sm text-indigo-600">{pluralize(modal.selectedQuiz.questions.length, 'question')}</p>
                    </div>
                    <div className="space-y-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Weight (%)</label>
                        <div className="flex gap-2">
                          {[10, 15, 20, 25].map(w => (
                            <button 
                              key={w}
                              onClick={() => setModal({ ...modal, weight: w })}
                              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${modal.weight === w ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                              {w}%
                            </button>
                          ))}
                          <input 
                            type="number" 
                            min="1" 
                            max="100"
                            value={modal.weight}
                            onChange={e => setModal({ ...modal, weight: parseInt(e.target.value) || 10 })}
                            className="w-20 px-2 py-2 border border-slate-300 rounded-lg text-center text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Due Date (optional)</label>
                        <input 
                          type="datetime-local"
                          value={modal.dueDate}
                          onChange={e => setModal({ ...modal, dueDate: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setModal({ ...modal, selectedQuiz: null })} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg">← Back</button>
                      <button 
                        onClick={() => assignQuiz(modal.selectedQuiz.id, modal.weight, modal.dueDate || null)} 
                        className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium"
                      >
                        Assign Quiz
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
            
            {/* Share Link Modal */}
            {modal === 'share-link' && (
              <>
                <div className="text-center mb-4">
                  <div className="text-5xl mb-2">🔗</div>
                  <p className="text-slate-600">Share this link with anyone!</p>
                </div>
                <div className="bg-slate-100 rounded-lg p-3 mb-4 break-all text-sm font-mono text-slate-700">
                  {modalInput}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setModal(null); setModalInput(''); }} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg">Close</button>
                  <button onClick={() => { 
                    navigator.clipboard.writeText(modalInput); 
                    showToast('Copied!', 'success');
                  }} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium">Copy Link</button>
                </div>
              </>
            )}
            
            {/* Quiz Created Modal - shows after generation */}
            {modal?.type === 'quiz-created' && (
              <>
                <div className="text-center mb-4">
                  <div className="text-5xl mb-2">🎉</div>
                  <h3 className="text-xl font-bold text-slate-900">Quiz Created!</h3>
                  <p className="text-slate-600 mt-1">"{modal.quiz.name}" • {pluralize(modal.quiz.questions.length, 'question')}</p>
                </div>
                
                <div className="space-y-3 mb-6">
                  <button 
                    onClick={() => {
                      shareQuiz(modal.quiz);
                      setModal(null);
                    }}
                    className="w-full p-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl text-left flex items-center gap-4 hover:from-indigo-400 hover:to-purple-400"
                  >
                    <span className="text-2xl">🔗</span>
                    <div>
                      <span className="font-semibold block">Share with Friends</span>
                      <span className="text-indigo-200 text-sm">Get a link anyone can use</span>
                    </div>
                  </button>
                  
                  <button 
                    onClick={() => {
                      const selected = shuffleArray([...modal.quiz.questions]).slice(0, 10).map(q => ({ ...q, options: shuffleArray([...q.options]) }));
                      setCurrentQuiz({ ...modal.quiz, questions: selected });
                      setQuizState({ currentQuestion: 0, selectedAnswer: null, answeredQuestions: new Set(), score: 0, results: [] });
                      setModal(null);
                      setPage('take-quiz');
                    }}
                    className="w-full p-4 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-left flex items-center gap-4"
                  >
                    <span className="text-2xl">🎯</span>
                    <div>
                      <span className="font-semibold block">Practice Now</span>
                      <span className="text-amber-100 text-sm">Test yourself with this quiz</span>
                    </div>
                  </button>
                  
                  <button 
                    onClick={() => {
                      setCurrentQuiz(modal.quiz);
                      setModal(null);
                      setPage('review-quiz');
                    }}
                    className="w-full p-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-left flex items-center gap-4"
                  >
                    <span className="text-2xl">👁️</span>
                    <div>
                      <span className="font-semibold block">Review Questions</span>
                      <span className="text-slate-500 text-sm">See all questions and answers</span>
                    </div>
                  </button>
                </div>
                
                <button 
                  onClick={() => { setModal(null); setPage(getDashboard()); }}
                  className="w-full py-2 text-slate-500 hover:text-slate-700 text-sm"
                >
                  Go to Dashboard →
                </button>
              </>
            )}
            
            {/* Delete Confirmation Modal */}
            {modal?.type === 'delete-confirm' && (
              <>
                <div className="text-center mb-4">
                  <div className="text-5xl mb-2">🗑️</div>
                  <h3 className="text-xl font-bold text-slate-900">Delete Quiz?</h3>
                  <p className="text-slate-600 mt-1">"{modal.quizName}" will be permanently deleted.</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setModal(null)} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg">Cancel</button>
                  <button onClick={() => deleteQuiz(modal.quizId)} className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-400 text-white rounded-lg font-medium">Delete</button>
                </div>
              </>
            )}
            
            {/* Confirm Modal */}
            {modal?.type === 'confirm' && (
              <>
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold text-slate-900">{modal.title}</h3>
                  <p className="text-slate-600 mt-1">{modal.message}</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setModal(null)} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg">Cancel</button>
                  <button onClick={() => { modal.onConfirm?.(); setModal(null); }} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium">Confirm</button>
                </div>
              </>
            )}
            
            {/* Timed Quiz Setup Modal */}
            {modal?.type === 'timed-setup' && (
              <>
                <div className="text-center mb-4">
                  <div className="text-5xl mb-2">⏱️</div>
                  <h3 className="text-xl font-bold text-slate-900">Timed Quiz</h3>
                  <p className="text-slate-600 mt-1">Simulate real exam conditions</p>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Time Limit</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[5, 10, 15, 20, 30, 45].map(mins => (
                      <button 
                        key={mins}
                        onClick={() => setModalInput(mins.toString())}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition ${modalInput === mins.toString() ? 'bg-indigo-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Questions</label>
                  <p className="text-sm text-slate-500">Up to 20 random questions from your bank</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setModal(null); setModalInput(''); }} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg">Cancel</button>
                  <button 
                    onClick={() => {
                      const mins = parseInt(modalInput) || 10;
                      const questions = shuffleArray([...questionBank]).slice(0, 20).map(q => ({ ...q, options: shuffleArray([...q.options]) }));
                      setCurrentQuiz({ id: `timed_${Date.now()}`, name: `Timed Practice (${mins} min)`, questions });
                      setQuizState({ currentQuestion: 0, selectedAnswer: null, answeredQuestions: new Set(), score: 0, results: [] });
                      setTimedMode(true);
                      setTimeLimit(mins * 60);
                      setModal(null);
                      setModalInput('');
                      setPage('take-quiz');
                    }} 
                    disabled={!modalInput}
                    className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-300 text-white rounded-lg font-medium"
                  >
                    Start Quiz ⏱️
                  </button>
                </div>
              </>
            )}
            
            {/* Review Answers Modal */}
            {modal?.type === 'review-answers' && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-slate-900">📋 Review Answers</h3>
                  <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
                </div>
                <div className="space-y-4">
                  {modal.results.map((result, idx) => {
                    const question = modal.questions[idx];
                    if (!question) return null;
                    return (
                      <div key={idx} className={`p-4 rounded-xl border-2 ${result.correct ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="flex items-start gap-3 mb-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${result.correct ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                            {result.correct ? '✓' : '✗'}
                          </span>
                          <p className="font-medium text-slate-900">{question.question}</p>
                        </div>
                        <div className="ml-9 space-y-1">
                          {!result.correct && (
                            <p className="text-sm"><span className="text-red-600">Your answer:</span> {question.options[result.selectedAnswer]?.text}</p>
                          )}
                          <p className="text-sm"><span className="text-green-600">Correct:</span> {question.options.find(o => o.isCorrect)?.text}</p>
                          {question.explanation && (
                            <p className="text-sm text-slate-600 mt-2 italic">💡 {question.explanation}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button onClick={() => setModal(null)} className="w-full mt-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium">Close</button>
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
      
      {/* EDIT QUESTION MODAL */}
      {editingQuestion && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditingQuestion(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">Edit Question</h2>
              <button onClick={() => setEditingQuestion(null)} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Question</label>
                <textarea 
                  value={editingQuestion.question.question}
                  onChange={e => setEditingQuestion(prev => ({ ...prev, question: { ...prev.question, question: e.target.value } }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Topic</label>
                  <input 
                    type="text"
                    value={editingQuestion.question.topic}
                    onChange={e => setEditingQuestion(prev => ({ ...prev, question: { ...prev.question, topic: e.target.value } }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Difficulty</label>
                  <select 
                    value={editingQuestion.question.difficulty}
                    onChange={e => setEditingQuestion(prev => ({ ...prev, question: { ...prev.question, difficulty: e.target.value } }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="Basic">Basic</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Options (click to set correct answer)</label>
                <div className="space-y-2">
                  {editingQuestion.question.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={() => setEditingQuestion(prev => ({
                          ...prev,
                          question: {
                            ...prev.question,
                            options: prev.question.options.map((o, j) => ({ ...o, isCorrect: j === i }))
                          }
                        }))}
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${opt.isCorrect ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                      >
                        {String.fromCharCode(65 + i)}
                      </button>
                      <input 
                        type="text"
                        value={opt.text}
                        onChange={e => setEditingQuestion(prev => ({
                          ...prev,
                          question: {
                            ...prev.question,
                            options: prev.question.options.map((o, j) => j === i ? { ...o, text: e.target.value } : o)
                          }
                        }))}
                        className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${opt.isCorrect ? 'border-green-300 bg-green-50' : 'border-slate-300'}`}
                      />
                      {opt.isCorrect && <span className="text-green-600">✓</span>}
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Explanation</label>
                <textarea 
                  value={editingQuestion.question.explanation}
                  onChange={e => setEditingQuestion(prev => ({ ...prev, question: { ...prev.question, explanation: e.target.value } }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  rows={2}
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingQuestion(null)} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg">
                Cancel
              </button>
              <button 
                onClick={() => saveQuestionEdit(editingQuestion.quizId, editingQuestion.index, editingQuestion.question)}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ONBOARDING MODAL */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl">
            {onboardingStep === 0 && (
              <>
                <div className="text-6xl text-center mb-4">👋</div>
                <h2 className="text-2xl font-bold text-center text-slate-900 mb-2">Welcome to QuizForge!</h2>
                <p className="text-slate-600 text-center mb-6">Let's take a quick tour to help you get started.</p>
                <div className="flex gap-3">
                  <button onClick={completeOnboarding} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg">Skip</button>
                  <button onClick={() => setOnboardingStep(1)} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium">Start Tour →</button>
                </div>
              </>
            )}
            {onboardingStep === 1 && (
              <>
                <div className="text-6xl text-center mb-4">📚</div>
                <h2 className="text-xl font-bold text-center text-slate-900 mb-2">Step 1: Upload Materials</h2>
                <p className="text-slate-600 text-center mb-6">Upload your lecture slides, PDFs, or any course materials. Our AI will analyze them to create smart quiz questions.</p>
                <div className="bg-slate-100 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-3 text-sm text-slate-700">
                    <span className="text-green-600">✓</span><span>Supports PDF, PowerPoint, Word, and images</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-700 mt-2">
                    <span className="text-green-600">✓</span><span>Multi-file upload supported</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setOnboardingStep(0)} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg">← Back</button>
                  <button onClick={() => setOnboardingStep(2)} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium">Next →</button>
                </div>
              </>
            )}
            {onboardingStep === 2 && (
              <>
                <div className="text-6xl text-center mb-4">⚡</div>
                <h2 className="text-xl font-bold text-center text-slate-900 mb-2">Step 2: Generate Questions</h2>
                <p className="text-slate-600 text-center mb-6">Choose the number of questions, difficulty level, and whether to focus on concepts or case details.</p>
                <div className="bg-slate-100 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-3 text-sm text-slate-700">
                    <span>🧠</span><span><strong className="text-slate-800">Concept-focused:</strong> Tests underlying theories</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-700 mt-2">
                    <span>📋</span><span><strong className="text-slate-800">Case-based:</strong> Tests specific case details</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setOnboardingStep(1)} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg">← Back</button>
                  <button onClick={() => setOnboardingStep(3)} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium">Next →</button>
                </div>
              </>
            )}
            {onboardingStep === 3 && (
              <>
                <div className="text-6xl text-center mb-4">🎯</div>
                <h2 className="text-xl font-bold text-center text-slate-900 mb-2">Step 3: Practice & Share</h2>
                <p className="text-slate-600 text-center mb-6">Practice your quizzes, track your progress, and share with friends or students.</p>
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 mb-6 border border-amber-200">
                  <div className="flex items-center gap-3 text-sm text-slate-700">
                    <span>🔥</span><span>Build streaks for daily practice</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-700 mt-2">
                    <span>🏆</span><span>Earn achievements as you improve</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-700 mt-2">
                    <span>📊</span><span>Track your progress over time</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setOnboardingStep(2)} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg">← Back</button>
                  <button onClick={() => { completeOnboarding(); setPage('create-quiz'); }} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium">Create Your First Quiz! 🎉</button>
                </div>
              </>
            )}
            {onboardingStep > 0 && (
              <div className="flex justify-center gap-2 mt-6">
                {[1, 2, 3].map(step => (
                  <div key={step} className={`w-2.5 h-2.5 rounded-full transition-colors ${onboardingStep === step ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* QUIZ ANALYTICS MODAL (for teachers) */}
      {showAnalytics && (() => {
        const analytics = getQuizAnalytics(showAnalytics);
        if (!analytics) return null;
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAnalytics(null)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-900">📊 Quiz Analytics</h2>
                <button onClick={() => setShowAnalytics(null)} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
              </div>
              
              <div className="mb-6">
                <h3 className="font-semibold text-slate-900 text-lg">{analytics.quiz.name}</h3>
                <p className="text-slate-500">{analytics.quiz.questions.length} questions</p>
              </div>
              
              {/* Overview Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-indigo-50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-indigo-600">{analytics.submissions}</p>
                  <p className="text-sm text-slate-600">Submissions</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-green-600">{analytics.avgScore || '--'}%</p>
                  <p className="text-sm text-slate-600">Average Score</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-amber-600">{analytics.hardestQuestions.length}</p>
                  <p className="text-sm text-slate-600">Hard Questions</p>
                </div>
              </div>
              
              {analytics.submissions === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-xl">
                  <div className="text-4xl mb-3">📭</div>
                  <p className="text-slate-600">No submissions yet. Assign this quiz to see analytics.</p>
                </div>
              ) : (
                <>
                  {/* Hardest Questions */}
                  {analytics.hardestQuestions.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-slate-900 mb-3">🔥 Most Challenging Questions</h4>
                      <div className="space-y-3">
                        {analytics.hardestQuestions.map((q, i) => (
                          <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">Q{q.questionIndex + 1}</span>
                              <span className="text-red-600 font-bold">{q.correctRate}% correct</span>
                            </div>
                            <p className="text-slate-800 text-sm">{q.question}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* All Questions Performance */}
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-3">📈 Question Performance</h4>
                    <div className="space-y-2">
                      {analytics.questions.map((q, i) => (
                        <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-100">
                          <span className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-sm font-bold text-slate-600">{i + 1}</span>
                          <div className="flex-1">
                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${q.correctRate === null ? 'bg-slate-300' : q.correctRate >= 70 ? 'bg-green-500' : q.correctRate >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${q.correctRate || 0}%` }}
                              />
                            </div>
                          </div>
                          <span className={`w-16 text-right text-sm font-medium ${q.correctRate === null ? 'text-slate-400' : q.correctRate >= 70 ? 'text-green-600' : q.correctRate >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                            {q.correctRate !== null ? `${q.correctRate}%` : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              
              <div className="mt-6 pt-4 border-t border-slate-200">
                <button onClick={() => setShowAnalytics(null)} className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg">
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PROGRESS CHART MODAL */}
      {showProgressChart && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowProgressChart(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">📈 Your Progress</h2>
              <button onClick={() => setShowProgressChart(false)} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
            </div>
            
            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-indigo-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-indigo-600">{studentProgress.quizzesTaken}</p>
                <p className="text-xs text-slate-600">Total Quizzes</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{avgScore}%</p>
                <p className="text-xs text-slate-600">Avg Score</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-orange-600">{studentProgress.currentStreak}</p>
                <p className="text-xs text-slate-600">Current Streak</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{studentProgress.longestStreak || 0}</p>
                <p className="text-xs text-slate-600">Best Streak</p>
              </div>
            </div>
            
            {/* Progress Chart */}
            <div className="mb-6">
              <h4 className="font-semibold text-slate-900 mb-3">Last 30 Days</h4>
              {(studentProgress.dailyHistory || []).length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-xl">
                  <div className="text-4xl mb-3">📊</div>
                  <p className="text-slate-600">Complete some quizzes to see your progress chart!</p>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-xl p-4">
                  {/* Simple bar chart */}
                  <div className="flex items-end gap-1 h-32">
                    {(studentProgress.dailyHistory || []).slice(-14).map((day, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center">
                        <div 
                          className={`w-full rounded-t ${day.avgScore >= 80 ? 'bg-green-500' : day.avgScore >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ height: `${day.avgScore}%` }}
                          title={`${day.date}: ${day.avgScore}% (${day.quizzes} quizzes)`}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-slate-500">
                    <span>{(studentProgress.dailyHistory || []).slice(-14)[0]?.date?.slice(5) || ''}</span>
                    <span>Today</span>
                  </div>
                  <div className="flex justify-center gap-4 mt-4 text-xs">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded" /> 80%+</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-500 rounded" /> 60-79%</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded" /> &lt;60%</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Recent Scores */}
            <div className="mb-6">
              <h4 className="font-semibold text-slate-900 mb-3">Recent Quiz Scores</h4>
              {studentProgress.recentScores.length === 0 ? (
                <p className="text-slate-500 text-sm">No quizzes completed yet</p>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {studentProgress.recentScores.slice(-8).map((score, i) => (
                    <span 
                      key={i} 
                      className={`px-3 py-1 rounded-full text-sm font-medium ${score >= 80 ? 'bg-green-100 text-green-700' : score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}
                    >
                      {score}%
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            {/* Achievements */}
            <div>
              <h4 className="font-semibold text-slate-900 mb-3">🏆 Achievements ({(studentProgress.achievements || []).length}/{ACHIEVEMENTS.length})</h4>
              <div className="grid grid-cols-2 gap-2">
                {ACHIEVEMENTS.map(a => {
                  const earned = (studentProgress.achievements || []).includes(a.id);
                  return (
                    <div 
                      key={a.id} 
                      className={`p-3 rounded-lg border ${earned ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200 opacity-50'}`}
                    >
                      <div className="font-medium text-sm">{a.name}</div>
                      <div className="text-xs text-slate-500">{a.description}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-200">
              <button onClick={() => setShowProgressChart(false)} className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg">
                Close
              </button>
            </div>
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
                  <button onClick={() => { setAuthMode('login'); setPage('auth'); }} className="px-4 py-2 text-white font-medium hover:bg-white/10 rounded-lg">Log In</button>
                  <button onClick={() => { setAuthMode('signup'); setPage('auth'); }} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-semibold hover:from-amber-400 hover:to-orange-400 shadow-md">Sign Up</button>
                </>
              )}
            </div>
          </nav>

          <div className="max-w-7xl mx-auto px-6 pt-12 md:pt-16 pb-8 md:pb-12 relative">
            {/* Love Note Sticker */}
            <div className="absolute top-0 right-0 md:right-4 transform rotate-3 hidden sm:block">
              <div className="bg-pink-500/90 backdrop-blur-sm text-white px-3 py-2 rounded-lg shadow-lg text-xs font-medium">
                <span className="flex items-center gap-1.5">
                  💝 Made with love for my GF
                </span>
              </div>
            </div>
            
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 text-amber-400 text-sm rounded-full mb-4">
                🎯 AI-Powered Assessment Platform
              </div>
              <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight mb-4 md:mb-6">
                Turn Course Materials into <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Smart Quizzes & Exams</span> in Seconds
              </h1>
              <p className="text-base md:text-xl text-indigo-200 mb-6">Upload slides, readings, or case studies. Our AI generates quizzes for students or full exams for your class.</p>
              <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                {isLoggedIn ? (
                  <button onClick={() => setPage(getDashboard())} className="px-6 py-3 bg-white text-indigo-900 rounded-xl font-semibold hover:bg-indigo-100 shadow-lg text-center">
                    Go to Dashboard →
                  </button>
                ) : (
                  <>
                    <button onClick={() => { setAuthMode('signup'); setAuthForm(f => ({ ...f, role: 'teacher' })); setPage('auth'); }} className="px-5 py-3 bg-indigo-100 text-indigo-900 rounded-xl font-bold hover:bg-indigo-200 shadow-lg text-sm border border-indigo-200">👩‍🏫 I'm a Teacher</button>
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
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-xs">Question 7 of 10</span>
                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">✓ 6 correct</span>
                  </div>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-1.5 mb-4"><div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full w-[70%]"></div></div>
                <div className="flex gap-2 mb-3">
                  <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-xs rounded-full">Game Theory</span>
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-xs rounded-full">Intermediate</span>
                </div>
                <p className="text-white text-sm md:text-base font-medium mb-3">Why does cooperation become harder as the number of firms increases?</p>
                <div className="space-y-1.5 mb-3">
                  <div className="p-2 rounded-lg border bg-slate-800/50 border-slate-600 opacity-70"><div className="flex items-center gap-2"><span className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-600 text-white text-xs font-bold">A</span><span className="text-white text-xs">More administrative complexity</span></div></div>
                  <div className="p-2 rounded-lg border bg-green-500/30 border-green-400"><div className="flex items-center gap-2"><span className="w-5 h-5 flex items-center justify-center rounded-full bg-green-500 text-white text-xs font-bold">B</span><span className="text-white text-xs flex-1">Each firm's share shrinks, but deviation gains stay constant</span><span className="text-green-300 text-xs font-bold">✓</span></div></div>
                  <div className="p-2 rounded-lg border bg-slate-800/50 border-slate-600 opacity-70"><div className="flex items-center gap-2"><span className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-600 text-white text-xs font-bold">C</span><span className="text-white text-xs">Government pays more attention</span></div></div>
                  <div className="p-2 rounded-lg border bg-slate-800/50 border-slate-600 opacity-70"><div className="flex items-center gap-2"><span className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-600 text-white text-xs font-bold">D</span><span className="text-white text-xs">Communication costs increase</span></div></div>
                </div>
                <div className="p-2 bg-blue-500/20 border border-blue-400/40 rounded-lg">
                  <p className="text-blue-300 font-medium text-xs mb-0.5">💡 Explanation</p>
                  <p className="text-slate-200 text-xs leading-relaxed">With n firms sharing profit, each gets π/n. As n increases, cooperation value shrinks while deviation gains remain attractive.</p>
                </div>
              </div>
            </div>
          </div>

          {/* How it Works */}
          <div className="bg-white py-12">
            <div className="max-w-4xl mx-auto px-6">
              <h2 className="text-xl font-bold text-center text-slate-900 mb-8">How It Works</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Teachers Column */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-indigo-700 mb-4 text-center">👩‍🏫 For Teachers</h3>
                  <div className="space-y-2">
                    <div className="bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm">
                      <div className="text-xl">📤</div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">Upload</h4>
                        <p className="text-slate-600 text-xs">Lecture slides, PDFs, or notes</p>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm">
                      <div className="text-xl">🧠</div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">Generate Quizzes & Exams</h4>
                        <p className="text-slate-600 text-xs">AI creates assessments instantly</p>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm">
                      <div className="text-xl">📊</div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">Assign & Track</h4>
                        <p className="text-slate-600 text-xs">Share with class, view results</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Students Column */}
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-blue-700 mb-4 text-center">👨‍🎓 For Students</h3>
                  <div className="space-y-2">
                    <div className="bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm">
                      <div className="text-xl">📋</div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">Join & Take</h4>
                        <p className="text-slate-600 text-xs">Complete assigned quizzes</p>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm">
                      <div className="text-xl">📚</div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">Create & Study</h4>
                        <p className="text-slate-600 text-xs">Upload notes, practice exams</p>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm">
                      <div className="text-xl">🔗</div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">Share & Compete</h4>
                        <p className="text-slate-600 text-xs">Quiz friends, study together</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Student Study Section */}
              <div className="mt-8 bg-amber-100 rounded-2xl p-6 border-2 border-amber-400">
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <div className="text-4xl">📚</div>
                  <div className="text-center md:text-left">
                    <h3 className="font-bold text-gray-900 text-lg mb-1">Study Smarter, Not Harder</h3>
                    <p className="text-gray-700 text-sm">Upload your course materials, past exams, or lecture notes — our AI generates practice exams tailored to your class. Perfect for exam prep!</p>
                  </div>
                  <button onClick={() => { setAuthMode('signup'); setAuthForm(f => ({ ...f, role: 'student' })); setPage('auth'); }} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-lg font-semibold text-sm whitespace-nowrap shadow-md">
                    Start Practicing →
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <footer className="bg-slate-900 py-8 px-6">
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚡</span>
                <span className="font-bold text-white">QuizForge</span>
                <span className="text-slate-400 text-sm ml-2">© 2026</span>
              </div>
              <div className="flex gap-6 text-sm">
                <a href="/privacy" className="text-slate-400 hover:text-white transition-colors">Privacy Policy</a>
                <a href="/terms" className="text-slate-400 hover:text-white transition-colors">Terms of Service</a>
                <button onClick={() => window.location.href = 'mailto:' + 'support' + '@' + 'quizforgeapp.com'} className="text-slate-400 hover:text-white transition-colors">Contact</button>
              </div>
            </div>
          </footer>
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
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && (authMode === 'login' ? handleLogin() : handleSignup())}
                  placeholder={authMode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                {authMode === 'login' && (
                  <button 
                    onClick={handleForgotPassword}
                    className="text-sm text-indigo-600 hover:underline mt-2 block"
                  >
                    Forgot password?
                  </button>
                )}
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
              
              {/* Social Login Divider */}
              <div className="flex items-center gap-4 my-4">
                <div className="flex-1 h-px bg-slate-200"></div>
                <span className="text-sm text-slate-400">or continue with</span>
                <div className="flex-1 h-px bg-slate-200"></div>
              </div>
              
              {/* Social Login Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleGoogleSignIn()}
                  className="flex-1 py-3 px-4 border border-slate-200 rounded-xl hover:bg-slate-50 flex items-center justify-center gap-2 font-medium text-slate-700"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google
                </button>
                <button
                  onClick={() => handleAppleSignIn()}
                  className="flex-1 py-3 px-4 border border-slate-200 rounded-xl hover:bg-slate-50 flex items-center justify-center gap-2 font-medium text-slate-700"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  Apple
                </button>
              </div>
              
            </div>
            
            {/* Role Selection Modal for Social Login */}
            {socialAuthPending && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full">
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Welcome to QuizForge!</h3>
                  <p className="text-slate-600 mb-4">One more step - tell us who you are:</p>
                  
                  <div className="space-y-3">
                    <button
                      onClick={() => completeSocialSignup('teacher')}
                      className="w-full p-4 rounded-xl border-2 border-slate-200 hover:border-purple-500 hover:bg-purple-50 text-left transition flex items-center gap-4"
                    >
                      <span className="text-3xl">👩‍🏫</span>
                      <div>
                        <span className="font-medium text-slate-900 block">I'm a Teacher</span>
                        <p className="text-xs text-slate-500">Create quizzes, manage classes</p>
                      </div>
                    </button>
                    <button
                      onClick={() => completeSocialSignup('student')}
                      className="w-full p-4 rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-left transition flex items-center gap-4"
                    >
                      <span className="text-3xl">👨‍🎓</span>
                      <div>
                        <span className="font-medium text-slate-900 block">I'm a Student</span>
                        <p className="text-xs text-slate-500">Join classes, take quizzes</p>
                      </div>
                    </button>
                    <button
                      onClick={() => completeSocialSignup('creator')}
                      className="w-full p-4 rounded-xl border-2 border-slate-200 hover:border-amber-500 hover:bg-amber-50 text-left transition flex items-center gap-4"
                    >
                      <span className="text-3xl">✨</span>
                      <div>
                        <span className="font-medium text-slate-900 block">Quiz Creator</span>
                        <p className="text-xs text-slate-500">Just making quizzes for myself</p>
                      </div>
                    </button>
                  </div>
                  
                  <button
                    onClick={() => setSocialAuthPending(null)}
                    className="w-full mt-4 text-slate-500 text-sm hover:text-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            
            <div className="mt-6 text-center text-sm">
              {authMode === 'login' ? (
                <p className="text-slate-600">
                  Don't have an account? <button onClick={() => { setAuthMode('signup'); setAuthError(''); setAuthForm(f => ({ ...f, password: '' })); }} className="text-indigo-600 font-medium hover:underline">Sign up</button>
                </p>
              ) : (
                <p className="text-slate-600">
                  Already have an account? <button onClick={() => { setAuthMode('login'); setAuthError(''); setAuthForm(f => ({ ...f, password: '' })); }} className="text-indigo-600 font-medium hover:underline">Log in</button>
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
              <div className="flex items-center gap-4 md:gap-8">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('landing')}><span className="text-xl">⚡</span><span className="font-bold text-slate-900 hidden sm:inline">QuizForge</span></div>
                <div className="hidden sm:flex items-center gap-4">
                  <button onClick={() => setPage('teacher-dashboard')} className="text-slate-600 hover:text-slate-900 text-sm font-medium">Dashboard</button>
                  <button onClick={() => setPage('create-quiz')} className="text-slate-600 hover:text-slate-900 text-sm font-medium">Create</button>
                  <button onClick={() => setPage('class-manager')} className="text-slate-600 hover:text-slate-900 text-sm font-medium">Classes</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage('profile')} className="flex items-center gap-2 px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 text-sm font-medium rounded-full">
                  <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs">{user?.name?.charAt(0).toUpperCase() || '?'}</span>
                  <span className="hidden sm:inline">{user?.name || 'Teacher'}</span>
                </button>
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="sm:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                  {mobileMenuOpen ? '✕' : '☰'}
                </button>
              </div>
            </div>
            {/* Mobile menu */}
            {mobileMenuOpen && (
              <div className="sm:hidden border-t border-slate-200 mt-3 pt-3 pb-2 space-y-2">
                <button onClick={() => { setPage('teacher-dashboard'); setMobileMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">📊 Dashboard</button>
                <button onClick={() => { setPage('create-quiz'); setMobileMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">⚡ Create Quiz</button>
                <button onClick={() => { setPage('class-manager'); setMobileMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">👥 Classes</button>
              </div>
            )}
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
                        <p className="text-sm text-slate-500 mb-3">{pluralize(quiz.questions.length, 'question')}</p>
                        <div className="flex gap-2 text-xs text-slate-500 mb-4">
                          <span className="px-2 py-1 bg-slate-100 rounded">{assignedTo} class{assignedTo !== 1 ? 'es' : ''}</span>
                          <span className="px-2 py-1 bg-slate-100 rounded">{totalSubmissions} submissions</span>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setShowAnalytics(quiz.id)}
                            className="flex-1 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-sm font-medium"
                            title="View quiz analytics"
                          >
                            📊 Analytics
                          </button>
                          <button 
                            onClick={() => {
                              setCurrentQuiz(quiz);
                              setPage('review-quiz');
                            }} 
                            className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium"
                          >
                            View →
                          </button>
                        </div>
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
              <div className="flex items-center gap-4 md:gap-8">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('landing')}><span className="text-xl">⚡</span><span className="font-bold text-slate-900 hidden sm:inline">QuizForge</span></div>
                <div className="hidden sm:flex items-center gap-4">
                  <button onClick={() => setPage('creator-dashboard')} className="text-slate-600 hover:text-slate-900 text-sm font-medium">Dashboard</button>
                  <button onClick={() => setPage('create-quiz')} className="text-slate-600 hover:text-slate-900 text-sm font-medium">Create</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage('profile')} className="flex items-center gap-2 px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 text-sm font-medium rounded-full">
                  <span className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs">{user?.name?.charAt(0).toUpperCase() || '?'}</span>
                  <span className="hidden sm:inline">{user?.name || 'Creator'}</span>
                </button>
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="sm:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                  {mobileMenuOpen ? '✕' : '☰'}
                </button>
              </div>
            </div>
            {mobileMenuOpen && (
              <div className="sm:hidden border-t border-slate-200 mt-3 pt-3 pb-2 space-y-2">
                <button onClick={() => { setPage('creator-dashboard'); setMobileMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">📊 Dashboard</button>
                <button onClick={() => { setPage('create-quiz'); setMobileMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">✨ Create Quiz</button>
              </div>
            )}
          </nav>
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Hey{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! ✨</h1>
                <p className="text-slate-600">Ready to create something amazing?</p>
              </div>
              <button onClick={() => setPage('create-quiz')} className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium hover:from-amber-400 hover:to-orange-400 shadow-lg">✨ Create Quiz</button>
            </div>
            
            {/* Streak display for creators */}
            {studentProgress.currentStreak > 0 && (
              <div className="mb-6 bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-3 rounded-xl inline-flex items-center gap-2">
                <span className="text-xl">🔥</span>
                <span className="font-bold">{studentProgress.currentStreak} Day Streak!</span>
              </div>
            )}
            
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
                        <div key={quiz.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl group">
                          <div>
                            <p className="font-medium text-slate-900">{quiz.name}</p>
                            <div className="flex gap-2 items-center">
                              <p className="text-sm text-slate-500">{pluralize(quiz.questions.length, 'question')}</p>
                              {quiz.tags?.length > 0 && quiz.tags.map((tag, i) => (
                                <span key={i} className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded">#{tag}</span>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2 items-center">
                            <button onClick={() => duplicateQuiz(quiz)} className="px-2 py-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg text-sm opacity-0 group-hover:opacity-100 transition-opacity" title="Duplicate">📋</button>
                            <button onClick={() => setModal({ type: 'delete-confirm', quizId: quiz.id, quizName: quiz.name })} className="px-2 py-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg text-sm opacity-0 group-hover:opacity-100 transition-opacity" title="Delete">🗑️</button>
                            <button onClick={() => shareQuiz(quiz)} className="px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-sm" title="Share quiz">🔗 Share</button>
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
            ) : (() => {
              // Calculate class stats
              const classStudents = selectedClass?.students || [];
              const classAssignmentsList = assignments.filter(a => a.classId === selectedClass?.id);
              const classSubmissionsList = submissions.filter(s => classAssignmentsList.some(a => a.id === s.assignmentId));
              const classAvg = classSubmissionsList.length > 0 ? Math.round(classSubmissionsList.reduce((sum, s) => sum + s.percentage, 0) / classSubmissionsList.length) : 0;
              
              // Get completion data per assignment
              const assignmentStats = classAssignmentsList.map(a => {
                const quiz = quizzes.find(q => q.id === a.quizId);
                const subs = submissions.filter(s => s.assignmentId === a.id);
                const completedCount = subs.length;
                const totalStudents = classStudents.length;
                const avgScore = subs.length > 0 ? Math.round(subs.reduce((sum, s) => sum + s.percentage, 0) / subs.length) : 0;
                return { ...a, quiz, submissions: subs, completedCount, totalStudents, avgScore };
              });
              
              // Get student performance data
              const studentStats = classStudents.map(student => {
                const studentSubs = classSubmissionsList.filter(s => s.studentName === student.name);
                const completed = studentSubs.length;
                const total = classAssignmentsList.length;
                const avgScore = studentSubs.length > 0 ? Math.round(studentSubs.reduce((sum, s) => sum + s.percentage, 0) / studentSubs.length) : null;
                return { ...student, submissions: studentSubs, completed, total, avgScore };
              });
              
              return (
                <>
                  {/* Class Header */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        {classes.length > 1 ? (
                          <select 
                            value={selectedClass?.id || ''} 
                            onChange={e => setCurrentClass(classes.find(c => c.id === e.target.value))}
                            className="text-2xl font-bold text-slate-900 bg-transparent border-none cursor-pointer focus:outline-none"
                          >
                            {classes.map(cls => (
                              <option key={cls.id} value={cls.id}>{cls.name}</option>
                            ))}
                          </select>
                        ) : (
                          <h1 className="text-2xl font-bold text-slate-900">{selectedClass?.name}</h1>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-slate-500 text-sm">Join Code:</span>
                          <span className="font-mono bg-indigo-100 px-2 py-0.5 rounded text-indigo-700 font-bold text-sm">{selectedClass?.code}</span>
                          <button onClick={() => { navigator.clipboard.writeText(selectedClass?.code || ''); showToast('📋 Code copied!', 'success'); }} className="text-xs text-indigo-600 hover:text-indigo-800">Copy</button>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setModal({ type: 'input', title: 'Create New Class', placeholder: 'Class name', confirmText: 'Create', onConfirm: createClass })} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 text-sm">+ New Class</button>
                        <button onClick={() => quizzes.length > 0 ? setModal({ type: 'select', title: 'Assign Quiz to ' + selectedClass?.name }) : showToast('Create a quiz first', 'error')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-500 text-sm">+ Assign Quiz</button>
                      </div>
                    </div>
                    
                    {/* Stats Row */}
                    <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-slate-900">{classStudents.length}</p>
                        <p className="text-xs text-slate-500">Students</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-indigo-600">{classAssignmentsList.length}</p>
                        <p className="text-xs text-slate-500">Assignments</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{classAvg || '--'}%</p>
                        <p className="text-xs text-slate-500">Class Average</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-amber-600">{classSubmissionsList.length}</p>
                        <p className="text-xs text-slate-500">Submissions</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Tabs */}
                  <div className="flex gap-1 mb-6 bg-white rounded-lg p-1 shadow-sm border border-slate-200 w-fit">
                    {['assignments', 'students', 'gradebook'].map(tab => (
                      <button 
                        key={tab}
                        onClick={() => setModalInput(tab)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${(modalInput || 'assignments') === tab ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        {tab === 'assignments' ? '📋 Assignments' : tab === 'students' ? '👥 Students' : '📊 Gradebook'}
                      </button>
                    ))}
                  </div>
                  
                  {/* Assignments Tab */}
                  {(modalInput || 'assignments') === 'assignments' && (
                    <div className="space-y-4">
                      {assignmentStats.length > 0 ? assignmentStats.map(a => {
                        const isOverdue = a.dueDate && new Date(a.dueDate) < new Date();
                        const isDueSoon = a.dueDate && !isOverdue && (new Date(a.dueDate) - new Date()) < 24 * 60 * 60 * 1000;
                        return (
                          <div key={a.id} className={`bg-white rounded-xl shadow-sm border p-5 ${isOverdue ? 'border-red-200' : 'border-slate-200'}`}>
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold text-slate-900">{a.quiz?.name || 'Unknown Quiz'}</h4>
                                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded">{a.weight || 10}%</span>
                                </div>
                                <p className="text-sm text-slate-500">{a.quiz?.questions.length || 0} questions</p>
                                {a.dueDate && (
                                  <p className={`text-xs mt-1 ${isOverdue ? 'text-red-600 font-medium' : isDueSoon ? 'text-amber-600' : 'text-slate-500'}`}>
                                    {isOverdue ? '⚠️ Overdue: ' : isDueSoon ? '⏰ Due soon: ' : '📅 Due: '}
                                    {new Date(a.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-slate-900">{a.avgScore > 0 ? `${a.avgScore}% avg` : 'No scores yet'}</p>
                                <p className="text-xs text-slate-500">{a.completedCount}/{a.totalStudents} completed</p>
                              </div>
                            </div>
                            {/* Progress bar */}
                            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all ${a.completedCount === a.totalStudents ? 'bg-green-500' : isOverdue ? 'bg-red-500' : 'bg-indigo-500'}`}
                                style={{ width: `${a.totalStudents > 0 ? (a.completedCount / a.totalStudents) * 100 : 0}%` }}
                              />
                            </div>
                            {/* Individual scores */}
                            {a.submissions.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-slate-100">
                                <div className="flex flex-wrap gap-2">
                                  {a.submissions.map((sub, i) => (
                                    <span key={i} className={`text-xs px-2 py-1 rounded-full ${sub.percentage >= 80 ? 'bg-green-100 text-green-700' : sub.percentage >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                      {sub.studentName.split(' ')[0]}: {sub.percentage}%
                                    </span>
                                  ))}
                                  {a.totalStudents - a.completedCount > 0 && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                                      +{a.totalStudents - a.completedCount} pending
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }) : (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                          <div className="text-4xl mb-3">📝</div>
                          <h4 className="font-semibold text-slate-900 mb-2">No Assignments Yet</h4>
                          <p className="text-slate-500 text-sm mb-4">Create a quiz and assign it to this class</p>
                          <button onClick={() => setPage('create-quiz')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Create Quiz</button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Students Tab */}
                  {modalInput === 'students' && (() => {
                    // Calculate weighted grades for students tab
                    const studentGradesForTab = studentStats.map(student => {
                      let weightedSum = 0;
                      let weightUsed = 0;
                      assignmentStats.forEach(a => {
                        const sub = student.submissions.find(s => s.assignmentId === a.id);
                        if (sub) {
                          weightedSum += sub.percentage * (a.weight || 10);
                          weightUsed += (a.weight || 10);
                        }
                      });
                      return { ...student, weightedGrade: weightUsed > 0 ? Math.round(weightedSum / weightUsed) : null };
                    });
                    
                    return (
                      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        {studentGradesForTab.length > 0 ? (
                          <div className="divide-y divide-slate-100">
                            {studentGradesForTab.map((student, i) => (
                              <div key={i} className="flex items-center justify-between p-4 hover:bg-slate-50">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">
                                    {student.name.substring(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-medium text-slate-900">{student.name}</p>
                                    <p className="text-xs text-slate-500">
                                      {student.completed}/{student.total} assignments completed
                                      {student.completed < student.total && <span className="text-amber-600 ml-1">⚠️</span>}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  {student.weightedGrade !== null ? (
                                    <p className={`text-lg font-bold ${student.weightedGrade >= 80 ? 'text-green-600' : student.weightedGrade >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                                      {student.weightedGrade}%
                                    </p>
                                  ) : (
                                    <p className="text-slate-400">--</p>
                                  )}
                                  <p className="text-xs text-slate-500">weighted grade</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-12 text-center">
                            <div className="text-4xl mb-3">👥</div>
                            <h4 className="font-semibold text-slate-900 mb-2">No Students Yet</h4>
                            <p className="text-slate-500 text-sm">Share the code <span className="font-mono bg-slate-100 px-2 py-1 rounded">{selectedClass?.code}</span> with your students</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  
                  {/* Gradebook Tab */}
                  {modalInput === 'gradebook' && (() => {
                    // Calculate weighted grades for each student
                    const totalWeight = assignmentStats.reduce((sum, a) => sum + (a.weight || 10), 0);
                    
                    const studentGrades = studentStats.map(student => {
                      let weightedSum = 0;
                      let weightUsed = 0;
                      
                      assignmentStats.forEach(a => {
                        const sub = student.submissions.find(s => s.assignmentId === a.id);
                        if (sub) {
                          weightedSum += sub.percentage * (a.weight || 10);
                          weightUsed += (a.weight || 10);
                        }
                      });
                      
                      const weightedGrade = weightUsed > 0 ? Math.round(weightedSum / weightUsed) : null;
                      return { ...student, weightedGrade };
                    });
                    
                    // CSV Export function
                    const exportCSV = () => {
                      const headers = ['Student', ...assignmentStats.map(a => `${a.quiz?.name} (${a.weight || 10}%)`), 'Weighted Grade'];
                      const rows = studentGrades.map(student => {
                        const scores = assignmentStats.map(a => {
                          const sub = student.submissions.find(s => s.assignmentId === a.id);
                          return sub ? sub.percentage : '';
                        });
                        return [student.name, ...scores, student.weightedGrade || ''];
                      });
                      
                      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `${selectedClass?.name || 'gradebook'}_grades.csv`;
                      link.click();
                      URL.revokeObjectURL(url);
                      showToast('📥 Gradebook exported!', 'success');
                    };
                    
                    return (
                      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        {studentGrades.length > 0 && assignmentStats.length > 0 ? (
                          <>
                            <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
                              <div className="text-sm text-slate-600">
                                Total weight: <span className="font-semibold text-slate-900">{totalWeight}%</span>
                                {totalWeight !== 100 && <span className="text-amber-600 ml-2">⚠️ Not 100%</span>}
                              </div>
                              <button 
                                onClick={exportCSV}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium flex items-center gap-1"
                              >
                                📥 Export CSV
                              </button>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                  <tr>
                                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-900">Student</th>
                                    {assignmentStats.map(a => (
                                      <th key={a.id} className="text-center px-4 py-3 text-sm font-semibold text-slate-900 min-w-[100px]">
                                        <div className="truncate max-w-[120px]" title={a.quiz?.name}>{a.quiz?.name}</div>
                                        <div className="text-xs font-normal text-slate-500">{a.weight || 10}%</div>
                                      </th>
                                    ))}
                                    <th className="text-center px-4 py-3 text-sm font-semibold text-slate-900 bg-indigo-50">
                                      <div>Weighted</div>
                                      <div className="text-xs font-normal text-slate-500">Grade</div>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {studentGrades.map((student, i) => (
                                    <tr key={i} className="hover:bg-slate-50">
                                      <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                          <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">
                                            {student.name.substring(0, 2).toUpperCase()}
                                          </div>
                                          <span className="font-medium text-slate-900">{student.name}</span>
                                        </div>
                                      </td>
                                      {assignmentStats.map(a => {
                                        const sub = student.submissions.find(s => s.assignmentId === a.id);
                                        return (
                                          <td key={a.id} className="text-center px-4 py-3">
                                            {sub ? (
                                              <span className={`font-medium ${sub.percentage >= 80 ? 'text-green-600' : sub.percentage >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                                                {sub.percentage}%
                                              </span>
                                            ) : (
                                              <span className="text-slate-300">--</span>
                                            )}
                                          </td>
                                        );
                                      })}
                                      <td className="text-center px-4 py-3 bg-indigo-50">
                                        {student.weightedGrade !== null ? (
                                          <span className={`font-bold ${student.weightedGrade >= 80 ? 'text-green-600' : student.weightedGrade >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                                            {student.weightedGrade}%
                                          </span>
                                        ) : (
                                          <span className="text-slate-300">--</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                {/* Class averages footer */}
                                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                                  <tr>
                                    <td className="px-4 py-3 font-semibold text-slate-900">Class Average</td>
                                    {assignmentStats.map(a => (
                                      <td key={a.id} className="text-center px-4 py-3 font-semibold text-indigo-600">
                                        {a.avgScore > 0 ? `${a.avgScore}%` : '--'}
                                      </td>
                                    ))}
                                    <td className="text-center px-4 py-3 bg-indigo-100 font-bold text-indigo-700">
                                      {(() => {
                                        const validGrades = studentGrades.filter(s => s.weightedGrade !== null);
                                        return validGrades.length > 0 
                                          ? Math.round(validGrades.reduce((sum, s) => sum + s.weightedGrade, 0) / validGrades.length) + '%'
                                          : '--';
                                      })()}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </>
                        ) : (
                          <div className="p-12 text-center">
                            <div className="text-4xl mb-3">📊</div>
                            <h4 className="font-semibold text-slate-900 mb-2">No Data Yet</h4>
                            <p className="text-slate-500 text-sm">Gradebook will populate as students complete assignments</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* STUDENT DASHBOARD */}
      {page === 'student-dashboard' && (
        <div className="min-h-screen bg-slate-100">
          <nav className="bg-white border-b border-slate-200 px-6 py-3 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <div className="flex items-center gap-4 md:gap-8">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('landing')}><span className="text-xl">⚡</span><span className="font-bold text-slate-900 hidden sm:inline">QuizForge</span></div>
                <div className="hidden sm:flex items-center gap-4">
                  <button onClick={() => setPage('student-dashboard')} className="text-slate-600 hover:text-slate-900 text-sm font-medium">Dashboard</button>
                  <button onClick={() => setPage('create-quiz')} className="text-slate-600 hover:text-slate-900 text-sm font-medium">Create</button>
                  <button onClick={() => setPage('student-classes')} className="text-slate-600 hover:text-slate-900 text-sm font-medium">Classes</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage('profile')} className="flex items-center gap-2 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm font-medium rounded-full">
                  <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">{user?.name?.charAt(0).toUpperCase() || '?'}</span>
                  <span className="hidden sm:inline">{user?.name || 'Student'}</span>
                </button>
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="sm:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                  {mobileMenuOpen ? '✕' : '☰'}
                </button>
              </div>
            </div>
            {mobileMenuOpen && (
              <div className="sm:hidden border-t border-slate-200 mt-3 pt-3 pb-2 space-y-2">
                <button onClick={() => { setPage('student-dashboard'); setMobileMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">📊 Dashboard</button>
                <button onClick={() => { setPage('create-quiz'); setMobileMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">⚡ Create Quiz</button>
                <button onClick={() => { setPage('student-classes'); setMobileMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">👥 Classes</button>
              </div>
            )}
          </nav>
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 mb-1">Hey{user?.name ? `, ${user.name.split(' ')[0]}` : ' there'}! 👋</h1>
                <p className="text-slate-600">Ready to practice?</p>
              </div>
              {studentProgress.currentStreak > 0 && (
                <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-xl flex items-center gap-2">
                  <span className="text-xl">🔥</span>
                  <div>
                    <p className="text-sm font-bold">{studentProgress.currentStreak} Day Streak!</p>
                    <p className="text-xs opacity-80">Best: {studentProgress.longestStreak || studentProgress.currentStreak}</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Achievement badges */}
            {studentProgress.achievements?.length > 0 && (
              <div className="mb-6 flex flex-wrap gap-2">
                {studentProgress.achievements.map(aId => {
                  const achievement = ACHIEVEMENTS.find(a => a.id === aId);
                  return achievement ? (
                    <span key={aId} className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm" title={achievement.description}>
                      {achievement.name}
                    </span>
                  ) : null;
                })}
              </div>
            )}
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5"><p className="text-3xl font-bold text-indigo-600">{studentProgress.quizzesTaken}</p><p className="text-sm text-slate-500">Quizzes Taken</p></div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5"><p className="text-3xl font-bold text-green-600">{avgScore}%</p><p className="text-sm text-slate-500">Average Score</p></div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5"><p className="text-3xl font-bold text-amber-600">{joinedClasses.length}</p><p className="text-sm text-slate-500">Classes</p></div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5"><p className="text-3xl font-bold text-purple-600">{questionBank.length}</p><p className="text-sm text-slate-500">Questions</p></div>
            </div>
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {pendingAssignments.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border-2 border-amber-300 p-6">
                    <h3 className="font-semibold text-slate-900 mb-4">📋 Assigned Quizzes</h3>
                    {pendingAssignments.map(a => {
                      // Try local quiz first, then use assignment's embedded quiz data
                      const localQuiz = quizzes.find(q => q.id === a.quizId);
                      const quizName = a.quizName || localQuiz?.name || 'Quiz';
                      const quizQuestions = a.quizQuestions || localQuiz?.questions || [];
                      const assignedClass = joinedClasses.find(c => c.id === a.classId) || classes.find(c => c.id === a.classId);
                      const isOverdue = a.dueDate && new Date(a.dueDate) < new Date();
                      const isDueSoon = a.dueDate && !isOverdue && (new Date(a.dueDate) - new Date()) < 24 * 60 * 60 * 1000;
                      const estimatedTime = quizQuestions.length ? Math.ceil(quizQuestions.length * 1.5) : null;
                      return (
                        <div key={a.id} className={`flex items-center justify-between p-4 rounded-lg mb-2 ${isOverdue ? 'bg-red-50 border border-red-200' : 'bg-amber-50'}`}>
                          <div>
                            <p className="font-medium text-slate-900">{quizName}</p>
                            <p className="text-sm text-slate-500">{quizQuestions.length ? pluralize(quizQuestions.length, 'question') : '?'} • {estimatedTime ? `~${estimatedTime} min` : ''} • From: {a.className || assignedClass?.name || 'Class'}</p>
                            {a.dueDate && (
                              <p className={`text-xs mt-1 ${isOverdue ? 'text-red-600 font-medium' : isDueSoon ? 'text-amber-600 font-medium' : 'text-slate-500'}`}>
                                {isOverdue ? '⚠️ Overdue!' : isDueSoon ? '⏰ Due soon:' : '📅 Due:'} {new Date(a.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                          <button onClick={() => startAssignment(a)} disabled={isActionLoading} className={`px-4 py-2 text-white rounded-lg font-medium ${isOverdue ? 'bg-red-500 hover:bg-red-400' : 'bg-amber-500 hover:bg-amber-400'} disabled:opacity-50`}>
                            {isOverdue ? 'Complete Now!' : 'Start →'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-slate-900">Self Practice</h3>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowProgressChart(true)} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm">📈 Progress</button>
                      <span className="text-sm text-slate-500">{questionBank.length} questions</span>
                    </div>
                  </div>
                  {questionBank.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-5xl mb-4">📚</div><h4 className="text-lg font-semibold text-slate-900 mb-2">No Practice Questions Yet</h4><p className="text-slate-600 mb-6">Upload materials or join a class</p>
                      <div className="flex gap-3 justify-center">
                        <button onClick={() => setPage('create-quiz')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Upload Material</button>
                        <button onClick={() => setPage('student-classes')} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg">Join Class</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Spaced Repetition */}
                      {(() => {
                        const dueCount = getQuestionsForReview().length;
                        if (dueCount > 0) {
                          return (
                            <button onClick={startSpacedPractice} className="w-full p-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 rounded-xl text-left flex justify-between items-center text-white mb-3">
                              <div><p className="font-semibold">🧠 Smart Review</p><p className="text-sm text-purple-100">{dueCount} questions due for review</p></div>
                              <span className="text-2xl">→</span>
                            </button>
                          );
                        }
                        return null;
                      })()}
                      
                      <button onClick={() => startPractice('all')} className="w-full p-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 rounded-xl text-left flex justify-between items-center text-white mb-3">
                        <div><p className="font-semibold">🎯 Practice All Topics</p><p className="text-sm text-indigo-100">{questionBank.length} questions from all your materials</p></div>
                        <span className="text-2xl">→</span>
                      </button>
                      
                      {/* Timed Mode Option */}
                      <button 
                        onClick={() => setModal({ 
                          type: 'timed-setup', 
                          questions: questionBank,
                          title: 'Start Timed Quiz'
                        })} 
                        className="w-full p-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 rounded-xl text-left flex justify-between items-center text-white mb-3"
                      >
                        <div><p className="font-semibold">⏱️ Timed Practice</p><p className="text-sm text-amber-100">Simulate real exam conditions</p></div>
                        <span className="text-2xl">→</span>
                      </button>
                      
                      {/* Show top topics with 2+ questions */}
                      {(() => {
                        const topicCounts = {};
                        questionBank.forEach(q => { topicCounts[q.topic] = (topicCounts[q.topic] || 0) + 1; });
                        const multiQuestionTopics = Object.entries(topicCounts).filter(([_, count]) => count >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5);
                        if (multiQuestionTopics.length === 0) return null;
                        return (
                          <div className="space-y-2">
                            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Focus Areas</p>
                            {multiQuestionTopics.map(([topic, count]) => (
                              <button key={topic} onClick={() => startPractice(topic)} className="w-full p-3 bg-slate-50 hover:bg-indigo-50 rounded-lg text-left flex justify-between items-center">
                                <span className="font-medium text-slate-700">{topic}</span>
                                <span className="text-sm text-slate-500">{count} questions</span>
                              </button>
                            ))}
                          </div>
                        );
                      })()}
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
                
                {/* Student's Created Quizzes */}
                {quizzes.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="font-semibold text-slate-900 mb-4">Your Created Quizzes</h3>
                    <div className="space-y-3">
                      {quizzes.map(quiz => (
                        <div key={quiz.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl group">
                          <div>
                            <p className="font-medium text-slate-900">{quiz.name}</p>
                            <p className="text-sm text-slate-500">{pluralize(quiz.questions.length, 'question')}</p>
                          </div>
                          <div className="flex gap-2 items-center">
                            <button onClick={() => setModal({ type: 'delete-confirm', quizId: quiz.id, quizName: quiz.name })} className="px-2 py-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg text-sm opacity-0 group-hover:opacity-100 transition-opacity" title="Delete">🗑️</button>
                            <button onClick={() => shareQuiz(quiz)} className="px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-sm" title="Share with friends">🔗 Share</button>
                            <button onClick={() => { setCurrentQuiz(quiz); setPage('review-quiz'); }} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm">View</button>
                            <button onClick={() => {
                              const selected = shuffleArray([...quiz.questions]).slice(0, 10).map(q => ({ ...q, options: shuffleArray([...q.options]) }));
                              setCurrentQuiz({ ...quiz, questions: selected });
                              setQuizState({ currentQuestion: 0, selectedAnswer: null, answeredQuestions: new Set(), score: 0, results: [] });
                              setPage('take-quiz');
                            }} className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg text-sm">Practice</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                  const pending = clsAssignments.filter(a => !submissions.some(s => s.assignmentId === a.id && (s.studentId === auth.currentUser?.uid || s.studentEmail === user?.email)));
                  return (
                    <div key={cls.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-slate-900">{cls.name}</h4>
                          <p className="text-sm text-slate-500 mb-3">{clsAssignments.length} quizzes • {pending.length} pending</p>
                        </div>
                        <button 
                          onClick={() => setModal({ 
                            type: 'confirm', 
                            title: 'Leave Class?', 
                            message: `Are you sure you want to leave "${cls.name}"? You won't receive any more assignments from this class.`, 
                            onConfirm: () => leaveClass(cls.id) 
                          })}
                          className="px-3 py-1 text-xs bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 rounded"
                        >
                          Leave
                        </button>
                      </div>
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
                  
                  {/* Drag & Drop Zone */}
                  <div 
                    onDragOver={handleDragOver}
                    onDragEnter={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-indigo-500', 'bg-indigo-50'); }}
                    onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-indigo-500', 'bg-indigo-50'); }}
                    onDrop={(e) => { e.currentTarget.classList.remove('border-indigo-500', 'bg-indigo-50'); handleDrop(e); }}
                    onClick={() => !uploadProgress.active && fileInputRef.current?.click()}
                    className={`mb-3 p-6 border-2 border-dashed border-slate-300 rounded-xl text-center cursor-pointer transition-colors hover:border-indigo-400 hover:bg-indigo-50/50 ${uploadProgress.active ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input 
                      ref={fileInputRef} 
                      type="file" 
                      multiple
                      accept=".docx,.pdf,.txt,.pptx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.presentationml.presentation" 
                      onChange={handleFileUpload} 
                      className="hidden" 
                      disabled={uploadProgress.active} 
                    />
                    <div className="text-4xl mb-2">📄</div>
                    <p className="font-medium text-slate-700">
                      {uploadProgress.active ? '⏳ Processing...' : 'Drop files here or click to upload'}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      PDF, Word (.docx), PowerPoint (.pptx), or Text files
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Multiple files supported • Up to 20 pages per PDF
                    </p>
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
                  
                  {/* Content textarea */}
                  <div className="relative">
                    <textarea value={quizContent} onChange={e => setQuizContent(e.target.value)} placeholder="Or paste your content here..." className="w-full h-48 px-4 py-3 border border-slate-300 rounded-xl resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" disabled={uploadProgress.active} />
                    {quizContent && (
                      <button 
                        onClick={() => setQuizContent('')}
                        className="absolute top-2 right-2 text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="flex justify-between mt-2 text-sm text-slate-500">
                    <span>{quizContent.length.toLocaleString()} characters</span>
                    <span>{quizContent.length < 500 ? '⚠️ Min 500 recommended' : '✓ Good'}</span>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Questions</label>
                    <select value={numQuestions} onChange={e => setNumQuestions(parseInt(e.target.value))} className="w-full px-4 py-3 border border-slate-300 rounded-xl">
                      <option value={5}>5</option><option value={10}>10</option><option value={15}>15</option><option value={20}>20</option><option value={25}>25</option><option value={30}>30</option><option value={40}>40</option><option value={50}>50</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1">All questions can be shared with friends</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Difficulty</label>
                    <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl">
                      <option value="basic">Basic</option><option value="mixed">Mixed</option><option value="advanced">Advanced</option>
                    </select>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Question Style</label>
                    <select value={questionStyle} onChange={e => setQuestionStyle(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm">
                      <option value="concept">📚 Concept-focused</option>
                      <option value="mixed">🔀 Mixed</option>
                      <option value="case">📋 Case-based</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1">{questionStyle === 'concept' ? 'Tests theories & frameworks, avoids case-specific details' : questionStyle === 'case' ? 'Tests specific examples from the material' : 'Mix of concepts and case examples'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Topic Focus <span className="text-slate-400 font-normal">(optional)</span></label>
                    <input
                      type="text"
                      value={topicFocus}
                      onChange={e => setTopicFocus(e.target.value)}
                      placeholder="e.g., Portfolio Theory, CAPM..."
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <p className="text-xs text-slate-400 mt-1">Leave empty for all topics</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Tags <span className="text-slate-400 font-normal">(optional, comma-separated)</span></label>
                  <input
                    type="text"
                    value={quizTagInput}
                    onChange={e => setQuizTagInput(e.target.value)}
                    placeholder="e.g., midterm, chapter5, economics"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">Organize quizzes with tags</p>
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
                <p className="text-slate-600">{pluralize(currentQuiz.questions.length, 'question')} {currentQuiz.published && <span className="text-green-600">• Published ✓</span>}</p>
              </div>
              <div className="flex gap-3">
                {currentQuiz.published ? (
                  <>
                    <button 
                      onClick={() => shareQuiz(currentQuiz)}
                      className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg font-medium"
                    >
                      🔗 Share
                    </button>
                    <button 
                      onClick={() => duplicateQuiz(currentQuiz)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
                    >
                      📋 Duplicate
                    </button>
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
                    <button onClick={() => shareQuiz(currentQuiz)} className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg">🔗 Share</button>
                    <button onClick={() => { setQuestionBank(prev => limitQuestionBank([...prev, ...currentQuiz.questions])); showToast('✅ Added to bank!', 'success'); }} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg">🗃️ Save Only</button>
                    <button onClick={publishQuiz} className="px-5 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium">✓ Publish</button>
                  </>
                )}
              </div>
            </div>
            
            {/* Quiz Tags */}
            {currentQuiz.tags?.length > 0 && (
              <div className="flex gap-2 mb-4 flex-wrap">
                {currentQuiz.tags.map((tag, i) => (
                  <span key={i} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">#{tag}</span>
                ))}
              </div>
            )}
            
            <div className="space-y-4">
              {currentQuiz.questions.map((q, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">{i + 1}</span>
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-full">{q.topic}</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${q.difficulty === 'Basic' ? 'bg-green-100 text-green-700' : q.difficulty === 'Intermediate' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{q.difficulty}</span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setEditingQuestion({ quizId: currentQuiz.id, index: i, question: { ...q } })}
                        className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded"
                      >
                        ✏️ Edit
                      </button>
                      {currentQuiz.questions.length > 1 && (
                        <button 
                          onClick={() => setModal({ type: 'confirm', title: 'Delete Question?', message: 'This cannot be undone.', onConfirm: () => deleteQuestion(currentQuiz.id, i) })}
                          className="px-2 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
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
            {/* Shared quiz header */}
            {sharedQuizMode && !isLoggedIn && (
              <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-amber-500/20 px-6 py-3">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-amber-400">⚡</span>
                    <span className="text-white text-sm font-medium">{currentQuiz.name}</span>
                    {sharedQuizData?.createdBy && <span className="text-slate-400 text-sm">by {sharedQuizData.createdBy}</span>}
                    {sharedQuizData?.timesTaken > 0 && <span className="text-indigo-400 text-sm">• {sharedQuizData.timesTaken} plays</span>}
                  </div>
                  <button onClick={() => { setAuthMode('login'); setPage('auth'); }} className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg">Sign In</button>
                </div>
              </div>
            )}
            <div className="max-w-3xl mx-auto px-6 py-8">
              <div className="flex items-center justify-between mb-6">
                <button onClick={() => {
                  stopTimer(); // Stop timer when exiting
                  if (sharedQuizMode && !isLoggedIn) {
                    setSharedQuizMode(false);
                    setSharedQuizData(null);
                    window.history.replaceState({}, '', window.location.pathname);
                    setPage('landing');
                  } else {
                    setPage(getDashboard());
                  }
                }} className="text-slate-400 hover:text-white">✕ Exit</button>
                <div className="flex items-center gap-4">
                  {/* Timer display for timed mode */}
                  {timedMode && timeLimit !== null && (
                    <span className={`px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2 ${timeLimit <= 60 ? 'bg-red-500/20 text-red-400 animate-pulse' : timeLimit <= 180 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-white'}`}>
                      ⏱️ {formatTime(timeLimit)}
                    </span>
                  )}
                  <span className="text-slate-400 text-sm">{quizState.currentQuestion + 1} / {currentQuiz.questions.length}</span>
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">✓ {quizState.score} correct</span>
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
                <p className="text-slate-400 mb-4">{percentage}% correct</p>
                {currentQuiz.timesTaken > 0 && (
                  <p className="text-indigo-400 text-sm mb-8">🔥 This quiz has been taken {currentQuiz.timesTaken} time{currentQuiz.timesTaken !== 1 ? 's' : ''}!</p>
                )}
                {!currentQuiz.timesTaken && <div className="mb-4" />}
                <div className="w-full bg-slate-700 rounded-full h-4 mb-8 overflow-hidden"><div className="h-full bg-gradient-to-r from-amber-500 to-orange-500" style={{ width: `${percentage}%` }} /></div>
                
                {/* Action buttons row */}
                <div className="flex flex-wrap justify-center gap-3 mb-6">
                  {/* Review Answers Button */}
                  <button 
                    onClick={() => setModal({ type: 'review-answers', results: quizState.results, questions: currentQuiz.questions })}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm flex items-center gap-2"
                  >
                    📋 Review Answers
                  </button>
                  
                  {/* Retry Wrong Answers - only if there were wrong answers */}
                  {quizState.results.some(r => !r.correct) && (
                    <button 
                      onClick={retryWrongAnswers}
                      className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-sm flex items-center gap-2"
                    >
                      🔄 Retry Wrong ({quizState.results.filter(r => !r.correct).length})
                    </button>
                  )}
                  
                  {/* Share Results Button - uses getShareUrl to prevent duplicates */}
                  <button 
                    onClick={async () => {
                      try {
                        const shareUrl = await getShareUrl(currentQuiz);
                        const text = `🎯 I scored ${percentage}% on "${currentQuiz.name}"!\n\nThink you can beat my score? Try it here:`;
                        
                        if (navigator.share) {
                          await navigator.share({ 
                            title: `Can you beat my ${percentage}% on QuizForge?`, 
                            text, 
                            url: shareUrl 
                          });
                        } else {
                          const fullText = `${text}\n${shareUrl}`;
                          await navigator.clipboard?.writeText(fullText);
                          showToast('📋 Score & quiz link copied!', 'success');
                        }
                      } catch (err) {
                        console.error('Share error:', err);
                        if (err.name !== 'AbortError') {
                          showToast('Could not share. Try again!', 'error');
                        }
                      }
                    }}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm flex items-center gap-2"
                  >
                    📤 Share Score & Quiz
                  </button>
                </div>
                
                {/* Social Share Buttons - all use same shareId */}
                <div className="flex justify-center gap-2 mb-6">
                  <button
                    onClick={async () => {
                      const shareUrl = await getShareUrl(currentQuiz);
                      const text = `🎯 I scored ${percentage}% on "${currentQuiz.name}"! Can you beat me?`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + shareUrl)}`, '_blank');
                    }}
                    className="px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm"
                    title="Share on WhatsApp"
                  >
                    WhatsApp
                  </button>
                  <button
                    onClick={async () => {
                      const shareUrl = await getShareUrl(currentQuiz);
                      const text = `🎯 I scored ${percentage}% on "${currentQuiz.name}"! Can you beat me?`;
                      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm"
                    title="Share on X/Twitter"
                  >
                    X / Twitter
                  </button>
                  <button
                    onClick={async () => {
                      const shareUrl = await getShareUrl(currentQuiz);
                      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
                    }}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
                    title="Share on Facebook"
                  >
                    Facebook
                  </button>
                </div>
                
                {/* Leaderboard for shared quizzes */}
                {currentQuiz.leaderboard && currentQuiz.leaderboard.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6 text-left">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">🏆 Leaderboard</h3>
                    <div className="space-y-2">
                      {currentQuiz.leaderboard.slice(0, 5).map((entry, i) => {
                        const isCurrentUser = entry.name === (user?.name || 'Anonymous') && entry.score === percentage;
                        return (
                          <div key={i} className={`flex items-center justify-between p-2 rounded-lg ${isCurrentUser ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-white/5'}`}>
                            <div className="flex items-center gap-3">
                              <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-500 text-white' : i === 1 ? 'bg-slate-400 text-white' : i === 2 ? 'bg-amber-700 text-white' : 'bg-slate-600 text-slate-300'}`}>
                                {i + 1}
                              </span>
                              <span className={`${isCurrentUser ? 'text-amber-300 font-medium' : 'text-slate-300'}`}>
                                {entry.name} {isCurrentUser && '(You)'}
                              </span>
                            </div>
                            <span className={`font-bold ${entry.score >= 80 ? 'text-green-400' : entry.score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                              {entry.score}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {currentQuiz.leaderboard.length > 5 && (
                      <p className="text-slate-500 text-xs mt-3 text-center">+{currentQuiz.leaderboard.length - 5} more players</p>
                    )}
                  </div>
                )}

                {/* Show sign-up prompt for non-logged-in users who took a shared quiz */}
                {sharedQuizMode && !isLoggedIn && (
                  <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-6 mb-6 text-left">
                    <h3 className="text-white font-semibold mb-2">📊 Want to save your progress?</h3>
                    <p className="text-slate-300 text-sm mb-4">Create a free account to track your scores, create your own quizzes, and study smarter!</p>
                    <div className="flex gap-3">
                      <button onClick={() => { 
                        setSharedQuizMode(false); 
                        setSharedQuizData(null);
                        // Clear URL params
                        window.history.replaceState({}, '', window.location.pathname);
                        setAuthMode('signup'); 
                        setPage('auth'); 
                      }} className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-lg font-medium">Sign Up Free</button>
                      <button onClick={() => { 
                        setSharedQuizMode(false); 
                        setSharedQuizData(null);
                        window.history.replaceState({}, '', window.location.pathname);
                        setAuthMode('login'); 
                        setPage('auth'); 
                      }} className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg">Log In</button>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-3">
                  {sharedQuizMode && !isLoggedIn ? (
                    <>
                      <button onClick={() => {
                        setQuizState({ currentQuestion: 0, selectedAnswer: null, answeredQuestions: new Set(), score: 0, results: [] });
                        setCurrentQuiz(q => ({ ...q, questions: shuffleArray(q.questions.map(qq => ({ ...qq, options: shuffleArray([...qq.options]) }))) }));
                        setPage('take-quiz');
                      }} className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl">Retake Quiz</button>
                      <button onClick={() => {
                        setSharedQuizMode(false);
                        setSharedQuizData(null);
                        window.history.replaceState({}, '', window.location.pathname);
                        setPage('landing');
                      }} className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Browse QuizForge</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setPage(getDashboard())} className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Dashboard</button>
                      <button onClick={() => {
                        setQuizState({ currentQuestion: 0, selectedAnswer: null, answeredQuestions: new Set(), score: 0, results: [] });
                        setCurrentQuiz(q => ({ ...q, questions: shuffleArray(q.questions.map(qq => ({ ...qq, options: shuffleArray([...qq.options]) }))) }));
                        setPage('take-quiz');
                      }} className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl">Retake</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
