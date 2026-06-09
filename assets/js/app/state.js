// ============================================================
// STATE (global variables)
// ============================================================

// NOTE: This file intentionally defines globals because the HTML
// uses inline handlers like onclick="openAskModal()".

let currentUser = {
  id: null,
  name: 'Alex Lim',
  role: 'student',
  initials: 'AL',
  profilePicture: null
};

let selectedRole = 'student';
let currentTab = 'all';
let currentFilter = 'all';
let activeTag = null;
let searchQuery = '';

let pendingTags = [];
let uploadedFile = null;
let uploadPreviewUrl = null;

let totalMembers = 0;
let savedIds = new Set();
let questionsLoading = false;

let isDark = false;

let openQuestionMenuId = null;
let openAnswerMenuId = null;

let editingQuestionId = null;
let editingAnswerId = null;
let questionMenuCloseBound = false;

// Mock questions (used as initial in-memory state; backend will overwrite).
const questions = [
  {
    id: 1,
    title: 'How do I solve this system of equations using elimination?',
    body: "I've tried substitution but I keep getting the wrong answer. I uploaded a photo of the problem from my textbook.",
    author: 'Jake Karimo',
    initials: 'JK',
    avatarColor: 'coral',
    time: '10 min ago',
    tags: ['#math', '#algebra'],
    views: 24,
    hasImage: true,
    answers: [],
    saved: false
  },
  {
    id: 2,
    title: "What's the difference between mitosis and meiosis?",
    body: 'For our upcoming exam, I need a clear comparison of the two processes.',
    author: 'Sofia Reyes',
    initials: 'SR',
    avatarColor: 'green',
    time: '2 hrs ago',
    tags: ['#biology'],
    views: 187,
    hasImage: false,
    answers: [
      {
        author: 'Ms. Torres',
        initials: 'MT',
        role: 'teacher',
        time: '1 hr ago',
        body: 'Mitosis produces two identical diploid daughter cells for growth and repair. Meiosis produces four genetically diverse haploid cells for sexual reproduction. The key difference is the number of divisions — mitosis has one division, meiosis has two.'
      }
    ],
    saved: false
  },
  {
    id: 3,
    title: "Can someone help me debug this Python loop? It's printing the wrong output.",
    body: "I'm using a while loop to calculate factorials but the result is always 0.",
    author: 'Petra Lim',
    initials: 'PL',
    avatarColor: 'pink',
    time: '5 hrs ago',
    tags: ['#programming', '#python'],
    views: 63,
    hasImage: false,
    answers: [
      {
        author: 'Ben Cruz',
        initials: 'BC',
        role: 'student',
        time: '4 hrs ago',
        body: "Check that you're initializing your result variable to 1, not 0. Multiplying anything by 0 stays 0. Also make sure your loop condition decrements correctly."
      },
      {
        author: 'Dan Melo',
        initials: 'DM',
        role: 'student',
        time: '3 hrs ago',
        body: "Also double check the indentation of your result line — Python is sensitive to that!"
      }
    ],
    saved: false
  },
  {
    id: 4,
    title: 'What caused the fall of the Roman Empire? Need help organizing my essay.',
    body: "I have three paragraphs but my teacher says my argument isn't cohesive.",
    author: 'Dan Melo',
    initials: 'DM',
    avatarColor: null,
    time: '8 hrs ago',
    tags: ['#history', '#essay-help'],
    views: 41,
    hasImage: false,
    answers: [],
    saved: false
  },
  {
    id: 5,
    title: 'How do I balance chemical equations?',
    body: 'I keep messing up when there are polyatomic ions involved.',
    author: 'Mia Santos',
    initials: 'MS',
    avatarColor: 'blue',
    time: '1 day ago',
    tags: ['#chemistry'],
    views: 95,
    hasImage: false,
    answers: [
      {
        author: 'Mr. Reeves',
        initials: 'MR',
        role: 'teacher',
        time: '20 hrs ago',
        body: 'Treat polyatomic ions as a single unit when they appear unchanged on both sides. Start by counting each element, then adjust coefficients — never subscripts. Always balance hydrogen and oxygen last.'
      }
    ],
    saved: false
  },
  {
    id: 6,
    title: 'What is the significance of the Gettysburg Address?',
    body: 'We covered it briefly in class but I want a deeper understanding for my exam.',
    author: 'Cris Tan',
    initials: 'CT',
    avatarColor: null,
    time: '2 days ago',
    tags: ['#history'],
    views: 52,
    hasImage: false,
    answers: [
      {
        author: 'Jake Karimo',
        initials: 'JK',
        role: 'student',
        time: '1 day ago',
        body: "It redefined the Civil War as a fight for equality and human liberty, not just preservation of the Union. Lincoln used it to tie the war to the Declaration of Independence's 'all men are created equal' ideal."
      }
    ],
    saved: false
  }
];

// Colors for avatars
const avatarColors = {
  coral: { bg: '#FAECE7', color: '#993C1D' },
  green: { bg: '#EAF3DE', color: '#27500A' },
  pink: { bg: '#FBEAF0', color: '#993556' },
  blue: { bg: '#E6F1FB', color: '#0C447C' },
  default: { bg: '#D3D1C7', color: '#444441' }
};

function getAvatarStyle(colorKey) {
  const c = avatarColors[colorKey] || avatarColors.default;
  return `background:${c.bg};color:${c.color}`;
}

// Expose globals for other modules (and inline handlers).
window.currentUser = currentUser;
window.selectedRole = selectedRole;
window.currentTab = currentTab;
window.currentFilter = currentFilter;
window.activeTag = activeTag;
window.searchQuery = searchQuery;
window.pendingTags = pendingTags;
window.uploadedFile = uploadedFile;
window.uploadPreviewUrl = uploadPreviewUrl;
window.totalMembers = totalMembers;
window.savedIds = savedIds;
window.questionsLoading = questionsLoading;
window.isDark = isDark;
window.openQuestionMenuId = openQuestionMenuId;
window.openAnswerMenuId = openAnswerMenuId;
window.editingQuestionId = editingQuestionId;
window.editingAnswerId = editingAnswerId;
window.questionMenuCloseBound = questionMenuCloseBound;
window.questions = questions;
window.avatarColors = avatarColors;
window.getAvatarStyle = getAvatarStyle;

