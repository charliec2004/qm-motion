import React from 'react';
import { createRoot } from 'react-dom';
import * as Accordion from '@radix-ui/react-accordion';
import './style.css';

const questions = [
  ['What comes with a Field Notes membership?', 'A quiet place to collect your ideas, a weekly writing prompt, and a small community of people making things. Your notes are yours to keep and export whenever you like.'],
  ['Can I bring my existing notes?', 'Yes. Start with a text or Markdown export, then organize your notes at your own pace. There is no required folder structure.'],
  ['How often do you send a writing prompt?', 'One prompt arrives each Monday. You can save it for later, skip a week, or turn the emails off in your settings.'],
];

function App() {
  return (
    <main>
      <p className="eyebrow">FIELD NOTES</p>
      <h1>A little room<br />for your next idea.</h1>
      <p className="intro">Simple tools. Thoughtful company. Start here.</p>
      <Accordion.Root className="faq" type="single" collapsible defaultValue="question-0">
        {questions.map(([question, answer], index) => (
          <Accordion.Item className="item" value={`question-${index}`} key={question}>
            <Accordion.Header className="header">
              <Accordion.Trigger className="trigger">
                <span>{question}</span><span className="symbol" aria-hidden="true">+</span>
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="content">
              <div className="answer">{answer}</div>
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>
      <p className="footer">Make space for the work that matters.</p>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
