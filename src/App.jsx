import { useState, useEffect } from 'react';
import './anki-style.css';

export default function AnkiQnaWebpage() {
  const [userId, setUserId] = useState('');
  const [inputId, setInputId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({ Sicher: 0, Einfach: 0, Schwierig: 0, 'Sehr Schwierig': 0 });
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewCompleted, setReviewCompleted] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [idError, setIdError] = useState(false);
  const [idCreated, setIdCreated] = useState(false);

  const STORAGE_KEY = 'qna_web_user_progress_v2';

  useEffect(() => {
    fetch('/questions_answers_cleaned.json')
      .then(res => res.json())
      .then(data => setQuestions(data))
      .catch(err => console.error("Error loading questions:", err));
  }, []);

  useEffect(() => {
    if (userId && questions.length > 0) {
      const progress = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const userData = progress[userId];

      if (!userData) {
        setUserId('');
        setIdError(true);
        return;
      }

      const newStats = { Sicher: 0, Einfach: 0, Schwierig: 0, 'Sehr Schwierig': 0 };
      Object.values(userData.ratings || {}).forEach(r => {
        if (newStats[r] !== undefined) newStats[r]++;
      });
      setStats(newStats);

      const unseen = questions
        .map((_, i) => i)
        .filter(i => !(userData.ratings && userData.ratings[i] === 'Sicher'));
      setQueue(unseen);
      if (unseen.length > 0) setCurrentIndex(unseen[0]);

      const newProgress = { ...progress, [userId]: userData };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newProgress));
    }
  }, [userId, questions]);

  const generateId = () => {
    if (!inputId.trim()) return;
    const progress = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (!progress[inputId.trim()]) {
      progress[inputId.trim()] = { ratings: {} };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      setCopiedId(false);
      setIdCreated(true);
      setIdError(false);
    }
  };

  const handleStart = () => {
    if (inputId.trim()) {
      const progress = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (!progress[inputId.trim()]) {
        setIdError(true);
        return;
      }
      setUserId(inputId.trim());
      setIdError(false);
    }
  };

  const rateCard = (rating) => {
    const progress = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const userData = progress[userId] || { ratings: {}, queue: [] };
    userData.ratings[currentIndex] = rating;

    setStats(prev => ({ ...prev, [rating]: (prev[rating] || 0) + 1 }));

    let newQueue = [...queue];
    newQueue.shift();

    if (rating === 'Einfach') {
      newQueue.splice(5, 0, currentIndex);
    } else if (rating === 'Schwierig') {
      newQueue.splice(2, 0, currentIndex);
    } else if (rating === 'Sehr Schwierig') {
      newQueue.splice(1, 0, currentIndex);
    }

    progress[userId] = userData;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    setQueue(newQueue);

    if (newQueue.length > 0) {
      setCurrentIndex(newQueue[0]);
      setFlipped(false);
    } else {
      setCurrentIndex(null);
      if (reviewMode) setReviewCompleted(true);
    }
  };

  const startReviewMode = () => {
    if (!userId || questions.length === 0) return;

    const progress = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const ratings = progress[userId]?.ratings || {};
    const toReview = Object.entries(ratings)
      .filter(([_, r]) => r !== 'Sicher')
      .map(([idx]) => parseInt(idx))
      .filter(i => !isNaN(i) && questions[i]);

    if (toReview.length === 0) {
      alert("Alle Fragen sind als 'Sicher' markiert. Nichts zu wiederholen!");
      setQueue([]);
      setCurrentIndex(null);
      setReviewCompleted(true);
      return;
    }

    const shuffled = [...toReview].sort(() => Math.random() - 0.5);
    setReviewMode(true);
    setReviewCompleted(false);
    setQueue(shuffled);
    setCurrentIndex(shuffled[0]);
    setFlipped(false);
  };

  const resetProgress = () => {
    const progress = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    delete progress[userId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    window.location.reload();
  };

  const currentCard = questions[currentIndex];
  const totalAnswered = Object.values(stats).reduce((a, b) => a + b, 0);
  const hasReviewable = Object.values(stats).some((count, i) => i > 0 && count > 0);

  return (
    <div className="anki-container">
      <h1 className="headline">Jangid QnA Innere Medizin Facharztprüfung</h1>

      {!userId ? (
        <div className="auth-container">
          <h2>Geben Sie Ihre Benutzer-ID ein</h2>
          <p>Sie können Ihre eigene ID wählen. Ihr Fortschritt wird gespeichert.</p>
          <input 
            value={inputId} 
            onChange={e => setInputId(e.target.value)} 
            placeholder="z. B. max_muster"
          />
          <button onClick={handleStart}>Starten</button>
          <button onClick={generateId}>Neue ID erstellen</button>
          {idCreated && <p className="id-created">Neue ID wurde erfolgreich erstellt!</p>}
          {idError && <p className="error-msg">ID existiert nicht. Bitte erstellen Sie eine neue.</p>}
        </div>
      ) : (
        <>
          <div className="counter">
            Beantwortet: {totalAnswered} / {questions.length} |
            Sicher: {stats.Sicher} | Einfach: {stats.Einfach} | Schwierig: {stats.Schwierig} | Sehr Schwierig: {stats['Sehr Schwierig']}
          </div>

          <div className="top-buttons">
            <button className="reset-button" onClick={resetProgress}>Zurücksetzen</button>
            {hasReviewable && <button className="review-button" onClick={startReviewMode}>Jetzt wiederholen</button>}
          </div>

          {reviewCompleted ? (
            <div className="review-summary">
              <h2>Wiederholung abgeschlossen 🎉</h2>
              <p>Sie haben alle Fragen mit Einfach, Schwierig oder Sehr Schwierig überprüft.</p>
              <button onClick={startReviewMode}>Wiederholung neu starten</button>
            </div>
          ) : currentCard ? (
            <div className={`card ${flipped ? 'flipped' : ''}`}>
              <div className="front-card">Frage: {currentCard.Question}</div>
              {flipped && <div className="back-card" style={{ color: '#065f1d' }}>Antwort: {currentCard.Answer}</div>}
              {!flipped && <button className="show-answer" onClick={() => setFlipped(true)}>Antwort anzeigen</button>}
            </div>
          ) : (
            <div>
              <p>Alle Fragen wurden beantwortet.</p>
              {!reviewMode && hasReviewable && <button onClick={startReviewMode}>Fragen wiederholen</button>}
            </div>
          )}

          {currentCard && flipped && (
            <div className="button-row">
              <button className="btn-green" onClick={() => rateCard('Sicher')}>Sicher</button>
              <button className="btn-yellow" onClick={() => rateCard('Einfach')}>Einfach</button>
              <button className="btn-orange" onClick={() => rateCard('Schwierig')}>Schwierig</button>
              <button className="btn-red" onClick={() => rateCard('Sehr Schwierig')}>Sehr Schwierig</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
