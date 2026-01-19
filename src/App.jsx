import { useState, useEffect, useCallback, useRef } from 'react';

const sampleText = `Drop in a URL, paste text, or upload a PDF to get started. This speed reader transforms any content into rapid serial visual presentation format, allowing you to read at speeds far beyond traditional reading. The technique displays words one at a time at a fixed focal point, eliminating eye movements and reducing subvocalization.`;

export default function App() {
    const [url, setUrl] = useState('');
    const [articleTitle, setArticleTitle] = useState('Speed Reader');
    const [articleSource, setArticleSource] = useState('Drop in a link, paste text, or upload PDF');
    const [text, setText] = useState(sampleText);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('');
    const [error, setError] = useState('');
    const [startPosition, setStartPosition] = useState(0);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [wpm, setWpm] = useState(300);
    const [wordsPerFlash, setWordsPerFlash] = useState(1);
    const [showPasteModal, setShowPasteModal] = useState(false);
    const [pastedText, setPastedText] = useState('');
    const [lightMode, setLightMode] = useState(false);
    const intervalRef = useRef(null);
    const fileInputRef = useRef(null);

  const words = text.split(/\s+/).filter(w => w.length > 0);
    const currentWord = words.slice(currentIndex, currentIndex + wordsPerFlash).join(' ');
    const progress = ((currentIndex + 1) / words.length) * 100;
    const msPerWord = (60 / wpm) * 1000;
    const timeRemaining = Math.ceil(((words.length - currentIndex) / wpm));

  const getSpeedLabel = (speed) => {
        if (speed < 200) return { label: 'Slow', color: 'text-blue-400' };
        if (speed <= 300) return { label: 'Normal', color: 'text-green-400' };
        if (speed <= 400) return { label: 'Fast', color: 'text-yellow-400' };
        if (speed < 888) return { label: 'Turbo', color: 'text-orange-400' };
        return { label: 'MAX', color: 'text-red-500 animate-pulse' };
  };

  const speedInfo = getSpeedLabel(wpm);
    const avgSpeed = 238;
    const timeSavedPct = wpm > avgSpeed ? Math.round(((wpm - avgSpeed) / avgSpeed) * 100) : 0;

  const loadContent = (title, source, content) => {
        setArticleTitle(title);
        setArticleSource(source);
        setText(content);
        setCurrentIndex(0);
        setStartPosition(0);
        setError('');
  };
