import React, { useState, useRef, useEffect } from 'react';
import { Chat } from '@google/genai';
import { createAnalysisChat, sendMessageToChat } from '../../services/geminiService';
import { ChatMessage } from '../../types';
import { UserIcon, SparklesIcon, LinkIcon } from '../icons/Icons';
import { marked } from 'marked';

export const ChatBot: React.FC = () => {
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setChat(createAnalysisChat());
        setMessages([{
            role: 'model',
            text: 'Hola, soy tu asistente de IA para apuestas. ¿En qué puedo ayudarte hoy?'
        }]);
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSendMessage = async () => {
        if (!input.trim() || !chat) return;

        const userMessage: ChatMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const { text, sources } = await sendMessageToChat(chat, input);
            const modelMessage: ChatMessage = { role: 'model', text, sources };
            setMessages(prev => [...prev, modelMessage]);
        } catch (error) {
            console.error(error);
            const errorMessage: ChatMessage = { role: 'model', text: 'Lo siento, he encontrado un error. Inténtalo de nuevo.' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <h3 className="text-xl font-semibold text-white mb-4">ChatBot Asistente</h3>
            <div className="flex-grow bg-gray-900 rounded-lg p-4 overflow-y-auto space-y-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-green-accent flex items-center justify-center flex-shrink-0"><SparklesIcon className="w-5 h-5 text-white" /></div>}
                        <div className={`max-w-md p-3 rounded-lg ${msg.role === 'model' ? 'bg-gray-700' : 'bg-blue-600 text-white'}`}>
                            <div className="prose prose-sm prose-invert" dangerouslySetInnerHTML={{ __html: marked.parse(msg.text || '') as string }}></div>
                            {msg.sources && msg.sources.length > 0 && (
                                <div className="mt-3 pt-2 border-t border-gray-600">
                                    <h5 className="text-xs font-semibold text-gray-400 mb-1">Fuentes:</h5>
                                    <ul className="space-y-1">
                                        {msg.sources.map((source, i) => (
                                            <li key={i}>
                                                <a
                                                    href={source.web?.uri}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center text-xs text-blue-400 hover:text-blue-300"
                                                >
                                                    <LinkIcon className="w-3 h-3 mr-1.5 flex-shrink-0" />
                                                    <span className="truncate">{source.web?.title || source.web?.uri}</span>
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                        {msg.role === 'user' && <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0"><UserIcon className="w-5 h-5 text-white" /></div>}
                    </div>
                ))}
                {isLoading && (
                    <div className="flex items-start gap-3">
                         <div className="w-8 h-8 rounded-full bg-green-accent flex items-center justify-center flex-shrink-0"><SparklesIcon className="w-5 h-5 text-white" /></div>
                         <div className="max-w-md p-3 rounded-lg bg-gray-700">
                            <div className="flex items-center space-x-1">
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-75"></span>
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150"></span>
                            </div>
                         </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="mt-4 flex">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
                    placeholder="Escribe tu mensaje..."
                    className="flex-grow bg-gray-700 border border-gray-600 rounded-l-md p-2.5 text-white focus:ring-green-accent focus:border-green-accent"
                />
                <button
                    onClick={handleSendMessage}
                    disabled={isLoading}
                    className="bg-green-accent hover:bg-green-600 text-white font-bold py-2 px-4 rounded-r-md transition duration-300 disabled:bg-gray-600"
                >
                    Enviar
                </button>
            </div>
        </div>
    );
};