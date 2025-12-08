import React from 'react';
import { Link } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";

const LandingPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-900 text-white font-sans selection:bg-indigo-500 selection:text-white overflow-x-hidden">
            {/* Navigation */}
            <nav className="container mx-auto px-6 py-6 flex justify-between items-center relative z-10">
                <div className="text-2xl font-bold text-indigo-400 tracking-tighter flex items-center gap-2">
                    <span className="text-3xl">📄</span> Resumate
                </div>
                <div className="space-x-4">
                    <SignedIn>
                        <Link to="/dashboard" className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors">
                            Dashboard
                        </Link>
                    </SignedIn>
                    <SignedOut>
                        <SignInButton mode="modal">
                            <button className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors">
                                Sign In
                            </button>
                        </SignInButton>
                    </SignedOut>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="container mx-auto px-6 mt-20 lg:mt-32 text-center relative z-10">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] -z-10"></div>

                <div className="inline-block px-3 py-1 mb-6 text-xs font-semibold tracking-wider text-indigo-300 uppercase bg-indigo-900/30 rounded-full border border-indigo-800 animate-fade-in-up">
                    AI-Powered Resume Tailoring
                </div>
                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 animate-fade-in-up delay-100">
                    Craft Your Perfect <br className="hidden md:block" /> Career Narrative.
                </h1>
                <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed animate-fade-in-up delay-200">
                    Resumate intelligently adapts your resume for every job application.
                    Stand out with precision-tailored content that speaks directly to recruiters.
                </p>

                <div className="flex flex-col sm:flex-row justify-center items-center gap-4 animate-fade-in-up delay-300">
                    <SignedIn>
                        <Link
                            to="/dashboard"
                            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-indigo-500/20"
                        >
                            Go to Dashboard
                        </Link>
                    </SignedIn>
                    <SignedOut>
                        <SignInButton mode="modal">
                            <button className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-indigo-500/20">
                                Try Now &rarr;
                            </button>
                        </SignInButton>
                    </SignedOut>

                    <a href="#how-it-works" className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-lg transition-all border border-gray-700">
                        Learn More
                    </a>
                </div>
            </header>

            {/* How It Works Section */}
            <section id="how-it-works" className="container mx-auto px-6 py-32 relative">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">How Resumate Works</h2>
                    <p className="text-gray-400 max-w-2xl mx-auto">Three simple steps to your dream job interview.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {[
                        {
                            step: "01",
                            title: "Upload & Parse",
                            desc: "Paste your existing resume. Our AI extracts your skills, experience, and achievements into a structured profile.",
                            icon: "📝"
                        },
                        {
                            step: "02",
                            title: "Target the Job",
                            desc: "Paste the job description you're applying for. We analyze the requirements to find the perfect match.",
                            icon: "🎯"
                        },
                        {
                            step: "03",
                            title: "Generate & Apply",
                            desc: "Get a perfectly tailored resume in seconds, optimized for ATS and human readers. Download as PDF.",
                            icon: "🚀"
                        }
                    ].map((item, idx) => (
                        <div key={idx} className="relative p-8 bg-gray-800/30 rounded-2xl border border-gray-700/50 hover:border-indigo-500/30 transition-colors group">
                            <div className="absolute -top-6 left-8 text-6xl font-bold text-gray-800 group-hover:text-indigo-900/50 transition-colors select-none">
                                {item.step}
                            </div>
                            <div className="relative z-10">
                                <div className="text-4xl mb-4">{item.icon}</div>
                                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                                <p className="text-gray-400 leading-relaxed">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features Grid */}
            <section className="bg-gray-800/30 py-32">
                <div className="container mx-auto px-6">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div>
                            <h2 className="text-3xl md:text-4xl font-bold mb-6">Why Choose Resumate?</h2>
                            <div className="space-y-8">
                                {[
                                    { title: "Beat the ATS", desc: "Keywords are naturally woven into your narrative to pass automated filters." },
                                    { title: "Save Hours of Time", desc: "Stop rewriting the same bullet points. Let AI do the heavy lifting." },
                                    { title: "Manage Multiple Profiles", desc: "Keep different versions of your persona for different career paths." }
                                ].map((feature, idx) => (
                                    <div key={idx} className="flex gap-4">
                                        <div className="w-12 h-12 rounded-full bg-indigo-900/50 flex items-center justify-center text-indigo-400 font-bold shrink-0">
                                            ✓
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                                            <p className="text-gray-400">{feature.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl transform rotate-3 opacity-20 blur-lg"></div>
                            <div className="relative bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-2xl">
                                {/* Mock UI */}
                                <div className="flex items-center gap-4 mb-6 border-b border-gray-800 pb-4">
                                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                    <div className="ml-auto text-xs text-gray-500">Preview</div>
                                </div>
                                <div className="space-y-4">
                                    <div className="h-4 bg-gray-800 rounded w-3/4"></div>
                                    <div className="h-4 bg-gray-800 rounded w-1/2"></div>
                                    <div className="h-32 bg-gray-800/50 rounded border border-gray-700/50 p-4">
                                        <div className="flex gap-2 mb-2">
                                            <div className="h-2 bg-indigo-500/50 rounded w-16"></div>
                                            <div className="h-2 bg-indigo-500/50 rounded w-12"></div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="h-2 bg-gray-700 rounded w-full"></div>
                                            <div className="h-2 bg-gray-700 rounded w-5/6"></div>
                                            <div className="h-2 bg-gray-700 rounded w-4/6"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="container mx-auto px-6 py-32 text-center">
                <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 rounded-3xl p-12 border border-indigo-500/30">
                    <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to land your next role?</h2>
                    <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                        Join thousands of professionals who are saving time and getting hired faster.
                    </p>
                    <SignedOut>
                        <SignInButton mode="modal">
                            <button className="px-8 py-4 bg-white text-indigo-900 hover:bg-gray-100 font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg">
                                Get Started for Free
                            </button>
                        </SignInButton>
                    </SignedOut>
                    <SignedIn>
                        <Link to="/dashboard" className="px-8 py-4 bg-white text-indigo-900 hover:bg-gray-100 font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg">
                            Go to Dashboard
                        </Link>
                    </SignedIn>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-gray-800 bg-gray-900 py-12">
                <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="text-gray-500 text-sm">
                        &copy; {new Date().getFullYear()} Resumate. All rights reserved.
                    </div>
                    <div className="flex gap-6 text-gray-400">
                        <a href="#" className="hover:text-white transition-colors">Privacy</a>
                        <a href="#" className="hover:text-white transition-colors">Terms</a>
                        <a href="#" className="hover:text-white transition-colors">Contact</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
