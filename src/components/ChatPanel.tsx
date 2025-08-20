import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// 初始化 Google Generative AI 客户端
const genAI = new GoogleGenerativeAI('AIzaSyAvWuUcp6CI0K7qT6zAWldIiF4Fu4ObjWU');

const ChatPanel: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const adjustHeight = () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    };

    textarea.addEventListener('input', adjustHeight);
    return () => textarea.removeEventListener('input', adjustHeight);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, newMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // 获取 Gemini 模型
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      
      // 调用模型生成内容
      const result = await model.generateContent(input.trim());
      const aiResponse = await result.response;
      const text = aiResponse.text();

      const response: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: text,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, response]);
    } catch (error) {
      console.error("Error fetching AI response:", error);
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h3>AI 助手</h3>
      </div>
      
      <div className="chat-messages">
        {messages.map(message => (
          <div
            key={message.id}
            className={`chat-message ${message.type}-message`}
          >
            <div className="message-content">{message.content}</div>
            <div className="message-time">{formatTime(message.timestamp)}</div>
          </div>
        ))}
        {isLoading && (
          <div className="chat-message assistant-message">
            <div className="message-content loading-dots">
              <span>.</span><span>.</span><span>.</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input" onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder="输入消息，按Enter发送..."
          rows={1}
          disabled={isLoading}
        />
        <button type="submit" disabled={!input.trim() || isLoading}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;