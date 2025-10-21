# Modular LaTeX Resume Generator

This modular system provides flexible and customizable resume generation with LaTeX. The system is broken down into several modules for easy maintenance and extension.

## Architecture

```
services/latex/
├── index.ts         # Main exports
├── utils.ts         # LaTeX utilities and escaping
├── templates.ts     # LaTeX class templates and document structure
├── sections.ts      # Individual section generators
├── builder.ts       # Main resume builder orchestrator
└── README.md        # This documentation
```

## Basic Usage

```typescript
import { generateLatexPdf } from '../latexService';

// Generate PDF with default configuration
const pdfBlob = await generateLatexPdf(resumeData);
```

## Advanced Usage

### Custom Configuration

```typescript
import { generateLatexPdf, createResumeBuilder } from '../latexService';

// Custom configuration
const config = {
    sections: {
        urlDisplayThreshold: 40, // Longer URLs before shortening
        showEmptyFields: false,
        customLabels: {
            skills: 'TECHNICAL SKILLS',
            experience: 'PROFESSIONAL EXPERIENCE',
            projects: 'KEY PROJECTS',
            education: 'EDUCATION & CERTIFICATIONS'
        }
    },
    sectionOrder: ['summary', 'skills', 'experience', 'projects', 'education'],
    enabledSections: ['summary', 'skills', 'experience', 'education'] // Skip projects
};

// Generate with custom config
const pdfBlob = await generateLatexPdf(resumeData, config);
```

### Using the Builder Directly

```typescript
import { ResumeBuilder } from '../latexService';

const builder = new ResumeBuilder({
    sections: {
        urlDisplayThreshold: 25,
        customLabels: {
            experience: 'WORK HISTORY'
        }
    }
});

// Generate LaTeX content
const latexContent = builder.generateLatexDocument(resumeData);

// Update configuration dynamically
builder.updateConfig({
    sectionOrder: ['skills', 'experience', 'education']
});
```

## Configuration Options

### ResumeBuilderConfig

- **sections**: Section-specific configuration
  - `urlDisplayThreshold`: URL length threshold for shortening (default: 30)
  - `showEmptyFields`: Whether to show empty fields (default: false)
  - `customLabels`: Custom section labels
- **sectionOrder**: Array defining section order
- **enabledSections**: Array of sections to include
- **template**: Template-specific configuration (future extensibility)

### SectionConfig

- **urlDisplayThreshold**: When to shorten URLs to display text
- **showEmptyFields**: Include fields even if empty
- **customLabels**: Override default section titles

## Extending the System

### Adding New Section Types

1. Create a new generator class in `sections.ts`:

```typescript
export class CertificationsGenerator {
    constructor(private config: SectionConfig = {}) {}

    generate(certifications: Certification[]): string {
        // Implementation
    }
}
```

2. Add to the `ResumeBuilder` class in `builder.ts`:

```typescript
private certificationsGenerator: CertificationsGenerator;

// In constructor
this.certificationsGenerator = new CertificationsGenerator(sectionConfig);

// In generateAllSections method
if (!enabledSections || enabledSections.includes('certifications')) {
    sections.certifications = this.certificationsGenerator.generate(certifications);
}
```

### Custom Templates

Create new templates in `templates.ts`:

```typescript
export const modernTemplate = `
% Modern template with different styling
\\documentclass[modern]{resume}
% ... template content
`;
```

### Custom Utilities

Add new utility functions in `utils.ts`:

```typescript
export const formatPhoneNumber = (phone: string): string => {
    // Format phone number for LaTeX
};
```

## Benefits of Modular Design

1. **Maintainability**: Each module has a single responsibility
2. **Testability**: Individual components can be tested in isolation
3. **Extensibility**: Easy to add new features without affecting existing code
4. **Customization**: Granular control over each aspect of resume generation
5. **Reusability**: Components can be reused across different resume styles

## Migration from Legacy Code

The old monolithic `latexService.ts` has been preserved as `latexService.before-modular.ts`. The new system maintains backward compatibility through the main `generateLatexPdf` function.

## Future Enhancements

- Multiple template support (modern, classic, minimal)
- Theme system (colors, fonts, spacing)
- Conditional formatting based on content
- Export to different formats (HTML, Word)
- Plugin system for custom sections