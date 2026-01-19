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

  const loadPdfJs = () => {
    return new Promise((resolve, reject) => {
      if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      script.onerror = () => reject(new Error('Failed to load PDF library'));
      document.head.appendChild(script);
    });
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { setError('Please upload a PDF file'); return; }
    setIsLoading(true);
    setLoadingMsg('Loading PDF library...');
    setError('');
    try {
      const pdfjsLib = await loadPdfJs();
      setLoadingMsg('Reading PDF...');
      const arrayBuffer = await file.arrayBuffer();
      setLoadingMsg('Parsing document...');
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      const totalPages = pdf.numPages;
      for (let i = 1; i <= totalPages; i++) {
        setLoadingMsg(`Extracting page ${i} of ${totalPages}...`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ').replace(/\s+/g, ' ');
        fullText += pageText + ' ';
      }
      fullText = fullText.trim();
      if (fullText.length < 50) throw new Error('Could not extract text. PDF may be scanned.');
      loadContent(file.name.replace('.pdf', '').replace(/[-_]/g, ' '), `PDF • ${totalPages} pages`, fullText);
    } catch (err) {
      setError(err.message || 'Failed to read PDF.');
    } finally {
      setIsLoading(false);
      setLoadingMsg('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const fetchArticle = async () => {
    if (!url.trim()) return;
    setIsLoading(true);
    setLoadingMsg('Fetching article...');
    setError('');
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8000,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: [{ role: 'user', content: `Extract the full article text from: ${url}\n\nReturn ONLY JSON: {"title": "...", "source": "...", "content": "..."}` }]
        })
      });
      const data = await response.json();
      const textContent = data.content?.filter(item => item.type === 'text').map(item => item.text).join('') || '';
      const jsonMatch = textContent.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.content?.length > 100) { loadContent(parsed.title || 'Article', parsed.source || new URL(url).hostname, parsed.content); return; }
      }
      throw new Error('parse_failed');
    } catch { setError('Could not fetch article. Try pasting text or uploading PDF.'); }
    finally { setIsLoading(false); setLoadingMsg(''); }
  };

  const handlePasteSubmit = () => {
    if (pastedText.trim().length > 50) {
      const firstLine = pastedText.trim().split('\n')[0].slice(0, 80);
      loadContent(firstLine.length > 60 ? firstLine.slice(0, 60) + '...' : firstLine, 'Pasted text', pastedText.trim());
      setShowPasteModal(false);
      setPastedText('');
    }
  };

  const play = useCallback(() => { if (currentIndex >= words.length - 1) setCurrentIndex(startPosition); setIsPlaying(true); }, [currentIndex, words.length, startPosition]);
  const pause = useCallback(() => setIsPlaying(false), []);
  const togglePlay = useCallback(() => isPlaying ? pause() : play(), [isPlaying, play, pause]);
  const restart = useCallback(() => { setCurrentIndex(startPosition); setIsPlaying(false); }, [startPosition]);
  const skip = useCallback((n) => setCurrentIndex(p => Math.max(0, Math.min(p + n, words.length - 1))), [words.length]);
  const adjustSpeed = useCallback((n) => setWpm(p => Math.max(50, Math.min(p + n, 888))), []);
  const seekTo = useCallback((pct) => setCurrentIndex(Math.min(Math.floor((pct / 100) * words.length), words.length - 1)), [words.length]);
  const setStartPoint = useCallback(() => setStartPosition(currentIndex), [currentIndex]);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex(p => { if (p >= words.length - wordsPerFlash) { setIsPlaying(false); return p; } return p + wordsPerFlash; });
      }, msPerWord * wordsPerFlash);
    } else if (intervalRef.current) clearInterval(intervalRef.current);
    return () => intervalRef.current && clearInterval(intervalRef.current);
  }, [isPlaying, msPerWord, words.length, wordsPerFlash]);

  useEffect(() => {
    const handleKey = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      switch (e.key) {
        case ' ': e.preventDefault(); togglePlay(); break;
        case 'ArrowLeft': skip(-10); break;
        case 'ArrowRight': skip(10); break;
        case 'ArrowUp': e.preventDefault(); adjustSpeed(25); break;
        case 'ArrowDown': e.preventDefault(); adjustSpeed(-25); break;
        case 'r': restart(); break;
        case 's': setStartPoint(); break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [togglePlay, skip, adjustSpeed, restart, setStartPoint]);

  const getFocusPoint = (word) => {
    if (!word) return { before: '', focus: '', after: '' };
    const i = Math.max(0, Math.floor(word.length * 0.3));
    return { before: word.slice(0, i), focus: word[i] || '', after: word.slice(i + 1) };
  };
  const { before, focus, after } = wordsPerFlash === 1 ? getFocusPoint(currentWord) : { before: '', focus: '', after: '' };

  const bg = lightMode ? 'bg-gray-50' : 'bg-zinc-950';
  const bgAlt = lightMode ? 'bg-white' : 'bg-zinc-900';
  const border = lightMode ? 'border-gray-200' : 'border-zinc-800';
  const textMain = lightMode ? 'text-gray-900' : 'text-white';
  const textMuted = lightMode ? 'text-gray-500' : 'text-zinc-500';
  const btnBg = lightMode ? 'bg-gray-200 hover:bg-gray-300' : 'bg-zinc-800 hover:bg-zinc-700';
  const inputBg = lightMode ? 'bg-white border-gray-300' : 'bg-zinc-800 border-zinc-700';

  return (
    <div className={`min-h-screen flex flex-col ${bg} ${textMain}`}>
      <input ref={fileInputRef} type="file" accept=".pdf" onChange={handlePdfUpload} className="hidden" />

      {showPasteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`rounded-xl max-w-2xl w-full p-6 border ${bgAlt} ${border}`}>
            <h3 className="text-xl font-medium mb-4">Paste Article Text</h3>
            <textarea value={pastedText} onChange={(e) => setPastedText(e.target.value)} placeholder="Paste your article text here..." className={`w-full h-64 px-4 py-3 border rounded-lg focus:outline-none resize-none ${inputBg} ${textMain}`} autoFocus />
            <div className="flex gap-3 mt-4 justify-end">
              <button onClick={() => { setShowPasteModal(false); setPastedText(''); }} className={`px-5 py-2 rounded-lg ${btnBg}`}>Cancel</button>
              <button onClick={handlePasteSubmit} disabled={pastedText.trim().length < 50} className="px-5 py-2 rounded-lg bg-gradient-to-r from-red-600 to-orange-500 text-white disabled:opacity-50">Load</button>
            </div>
          </div>
        </div>
      )}

      <div className={`p-4 border-b ${border} ${bgAlt}`}>
        <div className="max-w-4xl mx-auto flex gap-2 flex-wrap">
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste article URL..." className={`flex-1 min-w-48 px-4 py-3 rounded-lg border focus:outline-none ${inputBg} ${textMain}`} onKeyDown={(e) => e.key === 'Enter' && fetchArticle()} />
          <button onClick={fetchArticle} disabled={isLoading || !url.trim()} className="px-5 py-3 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-lg font-medium disabled:opacity-50">Fetch</button>
          <button onClick={() => setShowPasteModal(true)} disabled={isLoading} className={`px-5 py-3 rounded-lg font-medium ${btnBg}`}>Paste</button>
          <button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className={`px-5 py-3 rounded-lg font-medium ${btnBg}`}>PDF</button>
        </div>
        {isLoading && <p className={`text-sm mt-2 max-w-4xl mx-auto ${textMuted}`}>{loadingMsg}</p>}
        {error && <p className="text-amber-500 text-sm mt-2 max-w-4xl mx-auto">{error}</p>}
      </div>

      <div className={`p-4 border-b ${border}`}>
        <h1 className="text-lg font-medium">{articleTitle}</h1>
        <p className={`text-sm ${textMuted}`}>{articleSource}</p>
      </div>

      <div className="flex-1 flex items-center justify-center px-8">
        <div className="w-full max-w-4xl">
          <div className="h-40 flex items-center justify-center relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-red-500/30 -translate-x-1/2" />
            {wordsPerFlash === 1 ? (
              <div className="text-5xl md:text-7xl font-mono tracking-tight">
                <span className={textMuted}>{before}</span>
                <span className="text-red-500">{focus}</span>
                <span>{after}</span>
              </div>
            ) : (
              <div className="text-4xl md:text-5xl font-mono tracking-tight text-center">{currentWord}</div>
            )}
          </div>
          <div className="relative">
            <div className={`h-2 rounded-full mt-8 cursor-pointer overflow-hidden ${lightMode ? 'bg-gray-200' : 'bg-zinc-800'}`} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seekTo(((e.clientX - r.left) / r.width) * 100); }}>
              <div className="h-full bg-gradient-to-r from-red-600 to-orange-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
            {startPosition > 0 && <div className="absolute top-6 w-1 h-6 bg-green-500 rounded" style={{ left: `${(startPosition / words.length) * 100}%` }} />}
          </div>
          <div className={`flex justify-between text-sm mt-2 ${textMuted}`}>
            <span>Word {currentIndex + 1} / {words.length}</span>
            <span>{timeRemaining} min left</span>
          </div>
        </div>
      </div>

      <div className={`p-6 border-t ${border}`}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-4 mb-6">
            <button onClick={() => skip(-50)} className={`p-3 rounded-full ${btnBg}`}>⏪</button>
            <button onClick={togglePlay} className={`p-5 rounded-full ${lightMode ? 'bg-gray-900 text-white' : 'bg-white text-black'}`}>
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button onClick={() => skip(50)} className={`p-3 rounded-full ${btnBg}`}>⏩</button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
            <div className="flex items-center gap-3">
              <button onClick={() => adjustSpeed(-50)} className={`w-10 h-10 rounded-lg text-lg font-bold ${btnBg}`}>−</button>
              <div className="text-center w-28">
                <div className="text-2xl font-bold">{wpm} <span className={`text-sm ${textMuted}`}>wpm</span></div>
                <div className={`text-xs font-medium ${speedInfo.color}`}>{speedInfo.label}</div>
                {timeSavedPct > 0 && <div className="text-xs text-green-500">↑ {timeSavedPct}% faster</div>}
              </div>
              <button onClick={() => adjustSpeed(50)} className={`w-10 h-10 rounded-lg text-lg font-bold ${btnBg}`}>+</button>
            </div>

            <div className="flex items-center gap-2">
              {[1, 2, 3].map(n => (
                <button key={n} onClick={() => setWordsPerFlash(n)} className={`w-10 h-10 rounded-lg text-sm font-medium ${wordsPerFlash === n ? (lightMode ? 'bg-gray-900 text-white' : 'bg-white text-black') : btnBg}`}>{n}</button>
              ))}
            </div>

            <button onClick={() => setLightMode(!lightMode)} className={`px-4 py-2 rounded-lg text-sm ${btnBg}`}>
              {lightMode ? '🌙 Dark' : '☀️ Light'}
            </button>

            <button onClick={setStartPoint} className="px-4 py-2 rounded-lg bg-green-600/20 border border-green-500/50 text-green-500 text-sm">Set Start</button>
            <button onClick={restart} className={`px-4 py-2 rounded-lg text-sm ${btnBg}`}>Restart</button>
          </div>

          <div className={`text-center text-xs ${textMuted}`}>
            <span className={`px-2 py-1 rounded ${btnBg}`}>Space</span> Play
            <span className={`px-2 py-1 rounded mx-1 ${btnBg}`}>←→</span> Skip
            <span className={`px-2 py-1 rounded mx-1 ${btnBg}`}>↑↓</span> Speed
          </div>
        </div>
      </div>
    </div>
  );
}
