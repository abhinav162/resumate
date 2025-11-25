import React from 'react';
import { Link } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";

const LandingPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-900 text-white font-sans selection:bg-indigo-500 selection:text-white">
            {/* Navigation */}
            <nav className="container mx-auto px-6 py-6 flex justify-between items-center">
                <div className="text-2xl font-bold text-indigo-400 tracking-tighter">Resumate</div>
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
            <header className="container mx-auto px-6 mt-20 lg:mt-32 text-center">
                <div className="inline-block px-3 py-1 mb-6 text-xs font-semibold tracking-wider text-indigo-300 uppercase bg-indigo-900/30 rounded-full border border-indigo-800">
                    AI-Powered Resume Tailoring
                </div>
                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                    Craft Your Perfect <br className="hidden md:block" /> Career Narrative.
                </h1>
                <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
                    Resumate intelligently adapts your resume for every job application.
                    Stand out with precision-tailored content that speaks directly to recruiters.
                </p>

                <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
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

                    <a href="#features" className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-lg transition-all border border-gray-700">
                        Learn More
                    </a>
                </div>
            </header>

            {/* Features Preview (Optional/Minimal) */}
            <section id="features" className="container mx-auto px-6 py-32">
                <div className="grid md:grid-cols-3 gap-12">
                    {[
                        { title: "Smart Analysis", desc: "AI analyzes job descriptions to identify key requirements." },
                        { title: "Instant Tailoring", desc: "Your resume is rewritten to match the job's language and needs." },
                        { title: "Profile Management", desc: "Manage multiple versions of your professional profile with ease." }
                    ].map((feature, idx) => (
                        <div key={idx} className="p-8 bg-gray-800/50 rounded-2xl border border-gray-700/50 hover:border-indigo-500/30 transition-colors">
                            <h3 className="text-xl font-bold text-white mb-4">{feature.title}</h3>
                            <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-gray-800 py-12 text-center text-gray-500 text-sm">
                &copy; {new Date().getFullYear()} Resumate. All rights reserved.
            </footer>
        </div>
    );
};

export default LandingPage;
