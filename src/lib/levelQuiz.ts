import { translations } from './translations'

export type QuizQuestion = {
  id: string
  title: string
  options: { value: number; label: string }[]
}

export type QuizPage = {
  label: string
  questions: QuizQuestion[]
}

/** 12 perguntas do questionário de nível (registo). */
export const getQuizQuestions = (t: typeof translations.pt): QuizQuestion[] => [
  {
    id: 'q1', title: t.register.q1Title,
    options: [
      { value: 0, label: t.register.q1o0 },
      { value: 1, label: t.register.q1o1 },
      { value: 2, label: t.register.q1o2 },
      { value: 3, label: t.register.q1o3 },
    ],
  },
  {
    id: 'q2', title: t.register.q2Title,
    options: [
      { value: 0, label: t.register.q2o0 },
      { value: 1, label: t.register.q2o1 },
      { value: 2, label: t.register.q2o2 },
      { value: 3, label: t.register.q2o3 },
    ],
  },
  {
    id: 'q3', title: t.register.q3Title,
    options: [
      { value: 0, label: t.register.q3o0 },
      { value: 1, label: t.register.q3o1 },
      { value: 2, label: t.register.q3o2 },
      { value: 3, label: t.register.q3o3 },
    ],
  },
  {
    id: 'q4', title: t.register.q4Title,
    options: [
      { value: 0, label: t.register.q4o0 },
      { value: 1, label: t.register.q4o1 },
      { value: 2, label: t.register.q4o2 },
      { value: 3, label: t.register.q4o3 },
    ],
  },
  {
    id: 'q5', title: t.register.q5Title,
    options: [
      { value: 0, label: t.register.q5o0 },
      { value: 1, label: t.register.q5o1 },
      { value: 2, label: t.register.q5o2 },
      { value: 3, label: t.register.q5o3 },
    ],
  },
  {
    id: 'q6', title: t.register.q6Title,
    options: [
      { value: 0, label: t.register.q6o0 },
      { value: 1, label: t.register.q6o1 },
      { value: 2, label: t.register.q6o2 },
      { value: 3, label: t.register.q6o3 },
    ],
  },
  {
    id: 'q7', title: t.register.q7Title,
    options: [
      { value: 0, label: t.register.q7o0 },
      { value: 1, label: t.register.q7o1 },
      { value: 2, label: t.register.q7o2 },
      { value: 3, label: t.register.q7o3 },
    ],
  },
  {
    id: 'q8', title: t.register.q8Title,
    options: [
      { value: 0, label: t.register.q8o0 },
      { value: 1, label: t.register.q8o1 },
      { value: 2, label: t.register.q8o2 },
      { value: 3, label: t.register.q8o3 },
    ],
  },
  {
    id: 'q9', title: t.register.q9Title,
    options: [
      { value: 0, label: t.register.q9o0 },
      { value: 1, label: t.register.q9o1 },
      { value: 2, label: t.register.q9o2 },
      { value: 3, label: t.register.q9o3 },
    ],
  },
  {
    id: 'q10', title: t.register.q10Title,
    options: [
      { value: 0, label: t.register.q10o0 },
      { value: 1, label: t.register.q10o1 },
      { value: 2, label: t.register.q10o2 },
      { value: 3, label: t.register.q10o3 },
    ],
  },
  {
    id: 'q11', title: t.register.q11Title,
    options: [
      { value: 0, label: t.register.q11o0 },
      { value: 1, label: t.register.q11o1 },
      { value: 2, label: t.register.q11o2 },
      { value: 3, label: t.register.q11o3 },
    ],
  },
  {
    id: 'q12', title: t.register.q12Title,
    options: [
      { value: 0, label: t.register.q12o0 },
      { value: 1, label: t.register.q12o1 },
      { value: 2, label: t.register.q12o2 },
      { value: 3, label: t.register.q12o3 },
    ],
  },
]

/** Agrupa as 12 perguntas em 4 páginas de 3. */
export const getQuizPages = (t: typeof translations.pt): QuizPage[] => {
  const questions = getQuizQuestions(t)
  return [
    { label: t.register.quizExperience, questions: questions.slice(0, 3) },
    { label: t.register.quizTechnique, questions: questions.slice(3, 6) },
    { label: t.register.quizShots, questions: questions.slice(6, 9) },
    { label: t.register.quizStrategy, questions: questions.slice(9, 12) },
  ]
}
