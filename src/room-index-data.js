export const indexStations = ['education', 'resume', 'contact'];

export const indexLinks = {
  'resume-pdf': { label: 'Open résumé PDF', url: '/daniel-ryu-resume.pdf' },
  'send-email': { label: 'Email Daniel', url: 'mailto:danielcryu@gmail.com' },
  'open-linkedin': { label: 'LinkedIn', url: 'https://www.linkedin.com/in/danielcryu/' },
  'open-github': { label: 'GitHub', url: 'https://github.com/DanielRyu318' },
};

// Academic information, passed exams and contact details come from Daniel’s published PDF.
export const records = {
  education: {
    heading: 'Education', title: 'University of Illinois', subtitle: 'Urbana-Champaign',
    lines: ['B.S. in Computer Science + Mathematics', 'Expected May 2027'],
    actions: [{ action: 'exams', label: 'Actuarial exams' }],
  },
  exams: {
    heading: 'Credentials', title: 'Actuarial exams',
    lines: ['Exam P  ·  Passed July 2025', 'Exam FM  ·  Passed October 2025'],
    actions: [{ action: 'study', label: 'Education record' }],
  },
  resume: {
    heading: 'Résumé', title: 'Daniel Ryu', subtitle: 'One-page résumé',
    lines: ['Education, actuarial exams,', 'experience, projects and technical skills.'],
    actions: [{ action: 'resume-pdf', ...indexLinks['resume-pdf'] }],
  },
  contact: {
    heading: 'Contact', title: 'Daniel Ryu',
    lines: ['danielcryu@gmail.com'],
    actions: ['send-email', 'open-linkedin', 'open-github'].map(action => ({ action, ...indexLinks[action] })),
  },
};

export const indexSummary = key => {
  const r = records[key];
  return r ? [r.heading, r.title, r.subtitle, ...r.lines].filter(Boolean).join('. ') : '';
};
