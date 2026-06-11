# AI Viva Trainer

An AI-powered voice-interactive viva examination platform that simulates real engineering viva sessions using adaptive questioning, speech analysis, confidence evaluation, and real-time feedback.

Built to help students practice technical communication under pressure — not just memorize answers.

---

# The Problem

Most students prepare for viva exams by reading notes or solving written questions.

But real vivas are different.

You are expected to:

* Explain concepts verbally
* Think under pressure
* Handle unexpected follow-up questions
* Communicate clearly and confidently
* Defend your understanding in real time

Many students know the subject but struggle with:

* Nervousness
* Hesitation
* Poor technical communication
* Lack of speaking practice
* Inability to answer dynamic follow-up questions

Traditional mock tests cannot simulate this experience.

---

# What AI Viva Trainer Does

AI Viva Trainer recreates the experience of a real technical viva examiner.

The platform:

* Asks subject-specific technical questions
* Accepts both **typed and voice-based answers**
* Converts speech to text using AI transcription
* Evaluates conceptual correctness and communication quality
* Detects hesitation and confidence patterns
* Generates intelligent follow-up questions dynamically
* Produces a detailed viva performance report

The examiner adapts based on:

* Weak concepts
* Missing points
* Confidence level
* Previous responses
* Difficulty level

This creates a realistic conversational viva experience instead of a fixed chatbot flow.

---

# Core Features

## Voice-Based Viva System

* Record answers directly using microphone
* Real-time speech-to-text transcription
* Voice and text answer support
* AI-generated viva conversations

---

## Adaptive AI Examiner

Unlike static question-answer systems, the AI:

* Probes weak concepts
* Asks deeper follow-up questions
* Changes difficulty dynamically
* Simulates real examiner behavior

Every viva session becomes unique.

---

## AI Evaluation Engine

Each answer is evaluated on:

* Correctness
* Concept Understanding
* Communication Clarity
* Confidence
* Missing Concepts
* Technical Depth

The platform also provides:

* Improvement suggestions
* Revision recommendations
* Follow-up explanations

---

## Confidence & Communication Analysis

The system analyzes:

* Filler words
* Speaking fluency
* Communication quality
* Response structure
* Hesitation patterns

This helps students improve technical speaking skills, not just theoretical knowledge.

---

## Multiple Viva Modes

### Time-Based Viva

Practice under real interview pressure:

* 5 min
* 10 min
* 15 min

### Question-Based Viva

Configurable sessions:

* Number of main questions
* Follow-up depth
* Difficulty level

---

## Detailed Performance Report

At the end of every session, students receive:

* Overall Viva Score
* Confidence Score
* Communication Score
* Strong Topics
* Weak Topics
* Frequently Missed Concepts
* Improvement Suggestions
* Predicted Viva Performance

---

# How It Works

```text
AI Question
↓
Student speaks or types answer
↓
Speech-to-Text (Whisper)
↓
AI Evaluation Engine
↓
Confidence & Concept Analysis
↓
Adaptive Follow-up Question
↓
Final Viva Report
```

---

# Tech Stack

| Layer            | Technology              |
| ---------------- | ----------------------- |
| Framework        | Next.js 16 (App Router) |
| Language         | TypeScript              |
| Styling          | Tailwind CSS            |
| UI Components    | shadcn/ui + Radix UI    |
| AI Models        | Groq Llama 3.3 70B      |
| Speech-to-Text   | Groq Whisper            |
| State Management | React Context API       |
| Deployment       | Vercel                  |

---

# Why This Project Is Different

Most AI interview tools:

* Use fixed question lists
* Focus only on text
* Ignore communication skills
* Do not simulate pressure

AI Viva Trainer focuses on the *human side* of technical examinations:

* Verbal explanation
* Confidence
* Communication
* Dynamic questioning
* Real viva behavior

It is designed to feel like an actual examiner — not just a chatbot.

---
Open:

---

# Future Improvements

* Real-time voice emotion detection
* Webcam-based confidence analysis
* Faculty dashboard
* Multi-language viva support
* Viva transcript export
* Performance history tracking
* AI-generated revision plans
* Team discussion viva mode

---

# Inspiration

This project was inspired by the gap between theoretical preparation and real oral examinations faced by engineering students.

The goal is to make viva preparation:

* interactive,
* realistic,
* accessible,
* and stress-oriented in a productive way.

---

# Built With

* Next.js
* Groq API
* Whisper Speech-to-Text
* TypeScript
* Tailwind CSS
* React

---
