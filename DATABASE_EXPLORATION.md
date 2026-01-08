# Database Exploration - Complete Documentation

This folder contains comprehensive documentation of the Resumate database schema, models, and data layer.

## Quick Start

Start with one of these files based on your needs:

1. **SUMMARY.md** - Executive overview and quick reference
2. **database_schema.md** - Complete technical specification
3. **er_diagram.txt** - Visual entity-relationship diagram
4. **usage_examples.md** - Practical code examples
5. **ACTUAL_SCHEMA.sql** - SQL DDL and queries
6. **INDEX.md** - Navigation guide
7. **DISCOVERY_SUMMARY.txt** - Exploration details

## What You'll Find

- 8 database tables (users, base_resumes, experiences, education, projects, tailored_resumes, api_keys)
- 5 performance indexes
- Complete CRUD operation examples
- API endpoint documentation
- Data relationship diagrams
- JSON storage patterns
- Known limitations and improvement recommendations

## Key Facts

- Database: SQLite3
- Location: `apps/backend/data/resumate.db`
- Technology: Node.js/Express
- Models: Resume (with nested classes), TailoredResume
- API Endpoints: RESTful (GET, POST, PUT, DELETE)

## Navigation

See INDEX.md for detailed navigation by:
- Task (what you want to do)
- Role (your job title)
- Question (FAQ style)

## Files Overview

| File | Purpose | Best For |
|------|---------|----------|
| SUMMARY.md | Executive overview | Understanding the big picture |
| database_schema.md | Technical details | Understanding schema & design |
| er_diagram.txt | Visual relationships | Relationship understanding |
| usage_examples.md | Code examples | Implementation & copy-paste |
| ACTUAL_SCHEMA.sql | SQL statements | Database queries |
| INDEX.md | Navigation guide | Finding what you need |
| DISCOVERY_SUMMARY.txt | Exploration summary | Understanding what was discovered |

All documents cross-reference each other for easy navigation.
