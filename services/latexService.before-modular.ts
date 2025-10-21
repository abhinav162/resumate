import type { ResumeData } from '../types';

const LATEX_COMPILER_URL = 'https://latex.ytotech.com/builds/sync?pdf=true';

// Content of the resume.cls file provided by the user
const resumeClsContent = String.raw`
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% Medium Length Professional CV - RESUME CLASS FILE
%
% This template has been downloaded from:
% http://www.LaTeXTemplates.com
%
% This class file defines the structure and design of the template. 
%
% Original header:
% Copyright (C) 2010 by Trey Hunner
%
% Copying and distribution of this file, with or without modification,
% are permitted in any medium without royalty provided the copyright
% notice and this notice are preserved. This file is offered as-is,
% without any warranty.
%
% Created by Trey Hunner and modified by www.LaTeXTemplates.com
%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

\ProvidesClass{resume}[2010/07/10 v0.9 Resume class]

\LoadClass[9pt,a4paper]{report} % Font size and paper type

\usepackage[parfill]{parskip} % Remove paragraph indentation
\usepackage{array} % Required for boldface (\bf and \bfseries) tabular columns
\usepackage{ifthen} % Required for ifthenelse statements

\usepackage{hyperref}
\hypersetup{
    colorlinks=true,
    linkcolor=blue,
    filecolor=magenta,      
    urlcolor=blue,
    pdftitle={Resume},
    pdfauthor={Resume},
}

\usepackage[left=0.5 in,top=0.5 in,right=0.5 in,bottom=0.5 in]{geometry} % Document margins

\pagestyle{empty} % Suppress page numbers

%----------------------------------------------------------------------------------------
%	HEADINGS COMMANDS: Commands for printing name and address
%----------------------------------------------------------------------------------------

\def \name#1{\def\@name{#1}} % Defines the \name command to set name
\def \@name {} % Sets \@name to empty by default

\def \addressSep {$\diamond$} % Set default address separator to a diamond

% One, two or three address lines can be specified 
\let \@addressone \relax
\let \@addresstwo \relax
\let \@addressthree \relax

% \address command can be used to set the first, second, and third address (last 2 optional)
\def \address #1{
  \@ifundefined{@addresstwo}{
    \def \@addresstwo {#1}
  }{
  \@ifundefined{@addressthree}{
  \def \@addressthree {#1}
  }{
     \def \@addressone {#1}
  }}
}

% \printaddress is used to style an address line (given as input)
\def \printaddress #1{
  \begroup
    \def \\ {\addressSep\ }
    \centerline{#1}
  \endgroup
  \par
  \addressskip
}

% \printname is used to print the name as a page header
\def \printname {
  \begroup
    \hfil{\MakeUppercase{\namesize\bf \@name}}\hfil
    \nameskip\break
  \endgroup
}

%----------------------------------------------------------------------------------------
%	PRINT THE HEADING LINES
%----------------------------------------------------------------------------------------

\let\ori@document=\document
\renewcommand{\document}{
  \ori@document  % Begin document
  \printname % Print the name specified with \name
  \@ifundefined{@addressone}{}{ % Print the first address if specified
    \printaddress{\@addressone}}
  \@ifundefined{@addresstwo}{}{ % Print the second address if specified
    \printaddress{\@addresstwo}}
     \@ifundefined{@addressthree}{}{ % Print the third address if specified
    \printaddress{\@addressthree}}
}

%----------------------------------------------------------------------------------------
%	SECTION FORMATTING
%----------------------------------------------------------------------------------------

% Defines the rSection environment for the large sections within the CV
\newenvironment{rSection}[1]{ % 1 input argument - section name
  \sectionskip
  \MakeUppercase{{\bf #1}} % Section title
  \sectionlineskip
  \hrule % Horizontal line
  \begin{list}{}{ % List for each individual item in the section
    \setlength{\leftmargin}{0em} % Margin within the section
  }
  \item[]
}{
  \end{list}
}

% The below commands define the whitespace after certain things in the document - they can be \smallskip, \medskip or \bigskip
\def\namesize{\LARGE} % Size of the name at the top of the document
\def\addressskip{\smallskip} % The space between the two address (or phone/email) lines
\def\sectionlineskip{\medskip} % The space above the horizontal line for each section 
\def\nameskip{\medskip} % The space after your name at the top
\def\sectionskip{\medskip} % The space after the heading section
`;

/**
 * Escapes special LaTeX characters in a string.
 * @param str The input string.
 * @returns The escaped string.
 */
const escapeLatex = (str: string | undefined): string => {
    if (!str) return '';
    return str
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/&/g, '\\&')
        .replace(/%/g, '\\%')
        .replace(/\$/g, '\\$')
        .replace(/#/g, '\\#')
        .replace(/_/g, '\\_')
        .replace(/{/g, '\\{')
        .replace(/}/g, '\\}')
        .replace(/~/g, '\\textasciitilde{}')
        .replace(/\^/g, '\\textasciicircum{}');
};

/**
 * Ensures a URL has proper protocol and formats it for LaTeX hyperref.
 * @param url The input URL.
 * @returns A properly formatted URL.
 */
const formatUrl = (url: string | undefined): string => {
    if (!url) return '';
    
    // Trim whitespace
    url = url.trim();
    
    // Add https:// if no protocol is present
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    
    // URLs in LaTeX hyperref should not be escaped, but we need to handle % specially
    return url.replace(/%/g, '\\%');
};

/**
 * Generates the .tex file content as a string from resume data.
 * @param resumeData The user's tailored resume data.
 * @returns A string containing the full .tex file.
 */
const generateTexString = (resumeData: ResumeData): string => {
    const { contact, experience, education, projects, skills, summary } = resumeData;
    
    // Header
    const name = escapeLatex(contact.name);
    const address1 = `${escapeLatex(contact.phone)} \\\\ ${escapeLatex(contact.location)}`;
    
    // Build address2 with only provided fields
    const address2Parts: string[] = [];
    
    // Email is always included
    address2Parts.push(`\\href{mailto:${escapeLatex(contact.email)}}{${escapeLatex(contact.email)}}`);
    
    // LinkedIn - only if provided
    if (contact.linkedin && contact.linkedin.trim()) {
        // For long LinkedIn URLs, show just "LinkedIn" as display text
        const linkedinDisplay = contact.linkedin.length > 30 ? 'LinkedIn' : escapeLatex(contact.linkedin);
        address2Parts.push(`\\href{${formatUrl(contact.linkedin)}}{${linkedinDisplay}}`);
    }
    
    // GitHub - only if provided
    if (contact.github && contact.github.trim()) {
        const githubDisplay = contact.github.length > 30 ? 'GitHub' : escapeLatex(contact.github);
        address2Parts.push(`\\href{${formatUrl(contact.github)}}{${githubDisplay}}`);
    }
    
    // Website/Portfolio - only if provided
    if (contact.website && contact.website.trim()) {
        const websiteDisplay = contact.website.length > 30 ? 'Portfolio' : escapeLatex(contact.website);
        address2Parts.push(`\\href{${formatUrl(contact.website)}}{${websiteDisplay}}`);
    }
    
    const address2 = address2Parts.join(' \\\\ ');

    // Skills
    const skillsFormatted = skills.map(s => escapeLatex(s)).join(', ');

    // Experience
    const experienceFormatted = experience.map(exp => `
\\textbf{${escapeLatex(exp.role)}} \\hfill ${escapeLatex(exp.startDate)} -- ${escapeLatex(exp.endDate)}
${escapeLatex(exp.company)} \\hfill \\textit{${escapeLatex(exp.location)}}
 \\begin{itemize}
    \\itemsep -5pt {} 
    ${exp.responsibilities.map(r => `\\item ${escapeLatex(r)}`).join('\n    ')}
 \\end{itemize}
`).join('\n');
    
    // Projects
    const projectsFormatted = (projects || []).map(proj => `
\\item \\textbf{${escapeLatex(proj.name)}} 
${proj.url ? `\\textit{ \\href{${formatUrl(proj.url)}}{(View project)}}` : ''}
${proj.repoUrl ? `\\textit{ \\href{${formatUrl(proj.repoUrl)}}{(Source Code)}}` : ''}
\\begin{itemize}
    \\itemsep -5pt {} 
    ${proj.description.map(d => `\\item ${escapeLatex(d)}`).join('\n    ')}
\\end{itemize}
`).join('\n');

    // Education
    const educationFormatted = education.map(edu => `
{\\bf ${escapeLatex(edu.degree)}}, ${escapeLatex(edu.institution)} \\hfill {${escapeLatex(edu.graduationDate)}}\\
${edu.gpa ? `CGPA: ${escapeLatex(edu.gpa)}` : ''}
`).join('\n');

    return String.raw`
\documentclass{resume}

\name{${name}}
\address{${address1}} 
\address{${address2}}

\begin{document}

\begin{rSection}{SKILLS}
    ${skillsFormatted}
\end{rSection}

${summary ? `
\\begin{rSection}{SUMMARY}
    ${escapeLatex(summary)}
\\end{rSection}
` : ''}

\begin{rSection}{EXPERIENCE}
    ${experienceFormatted}
\end{rSection} 

\begin{rSection}{PROJECTS}
\\vspace{-1.25em}
    ${projectsFormatted}
\end{rSection} 

\begin{rSection}{Education}
    ${educationFormatted}
\end{rSection}

\end{document}
`;
};

/**
 * Calls an external API to compile LaTeX source into a PDF.
 * @param resumeData The resume data to be compiled.
 * @returns A promise that resolves with the PDF as a Blob.
 */
export const generateLatexPdf = async (resumeData: ResumeData): Promise<Blob> => {
    const texContent = generateTexString(resumeData);
    
    const payload = {
        resources: [
            { path: 'resume.tex', content: texContent, main: true },
            { path: 'resume.cls', content: resumeClsContent }
        ]
    };
    
    try {
        const response = await fetch(LATEX_COMPILER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            return await response.blob();
        } else {
            const errorText = await response.text();
            let errorMessage = "Unknown LaTeX compilation error.";
             try {
                // Try to parse as JSON in case it's a structured error
                const errorBody = JSON.parse(errorText);
                if (errorBody && errorBody.log) {
                    const logLine = errorBody.log.split('\n').find((line: string) => line.startsWith('! ')) || errorBody.log;
                    errorMessage = logLine.substring(2); // Remove the '! ' prefix
                } else {
                    errorMessage = errorBody.message || errorText;
                }
            } catch (e) {
                // If parsing fails, it's just plain text
                errorMessage = errorText;
            }
            throw new Error(errorMessage);
        }
    } catch (error: any) {
        console.error('Error calling LaTeX compiler API:', error.message);
        throw new Error(error.message || 'Failed to connect to the PDF compilation service.');
    }
};