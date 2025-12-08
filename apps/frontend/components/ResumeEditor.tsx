
import React, { useState } from 'react';
import type { ResumeData, Experience, Education, Project } from '../types';
import Button from './common/Button';
import Input from './common/Input';
import TextArea from './common/TextArea';
import Card from './common/Card';
import PlusIcon from './icons/PlusIcon';
import TrashIcon from './icons/TrashIcon';

interface ResumeEditorProps {
  resumeData: ResumeData;
  onSave: (updatedData: ResumeData) => void;
  onCancel: () => void;
}

const ResumeEditor: React.FC<ResumeEditorProps> = ({ resumeData, onSave, onCancel }) => {
  const [data, setData] = useState<ResumeData>(resumeData);

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setData({ ...data, contact: { ...data.contact, [e.target.name]: e.target.value } });
  };

  const handleSummaryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setData({ ...data, summary: e.target.value });
  };

  const handleExperienceChange = <T extends keyof Experience>(index: number, field: T, value: Experience[T]) => {
    const newExperience = [...data.experience];
    newExperience[index] = { ...newExperience[index], [field]: value };
    setData({ ...data, experience: newExperience });
  };

  const handleResponsibilityChange = (expIndex: number, respIndex: number, value: string) => {
    const newExperience = [...data.experience];
    newExperience[expIndex].responsibilities[respIndex] = value;
    setData({ ...data, experience: newExperience });
  }

  const addExperience = () => {
    const newExp: Experience = { id: `exp-${Date.now()}`, role: '', company: '', location: '', startDate: '', endDate: '', responsibilities: [''] };
    setData({ ...data, experience: [...data.experience, newExp] });
  };

  const removeExperience = (index: number) => {
    setData({ ...data, experience: data.experience.filter((_, i) => i !== index) });
  }

  const addResponsibility = (expIndex: number) => {
    const newExperience = [...data.experience];
    newExperience[expIndex].responsibilities.push('');
    setData({ ...data, experience: newExperience });
  }

  const removeResponsibility = (expIndex: number, respIndex: number) => {
    const newExperience = [...data.experience];
    newExperience[expIndex].responsibilities = newExperience[expIndex].responsibilities.filter((_, i) => i !== respIndex);
    setData({ ...data, experience: newExperience });
  }

  const handleEducationChange = <T extends keyof Education>(index: number, field: T, value: Education[T]) => {
    const newEducation = [...data.education];
    newEducation[index] = { ...newEducation[index], [field]: value };
    setData({ ...data, education: newEducation });
  };

  const addEducation = () => {
    const newEdu: Education = { id: `edu-${Date.now()}`, degree: '', institution: '', location: '', graduationDate: '' };
    setData({ ...data, education: [...data.education, newEdu] });
  };

  const removeEducation = (index: number) => {
    setData({ ...data, education: data.education.filter((_, i) => i !== index) });
  };

  const handleProjectChange = <T extends keyof Project>(index: number, field: T, value: Project[T]) => {
    const newProjects = [...data.projects];
    newProjects[index] = { ...newProjects[index], [field]: value };
    setData({ ...data, projects: newProjects });
  };

  const handleProjectDescriptionChange = (projIndex: number, descIndex: number, value: string) => {
    const newProjects = [...data.projects];
    newProjects[projIndex].description[descIndex] = value;
    setData({ ...data, projects: newProjects });
  }

  const addProject = () => {
    const newProj: Project = { id: `proj-${Date.now()}`, name: '', description: [''] };
    setData({ ...data, projects: [...(data.projects || []), newProj] });
  };

  const removeProject = (index: number) => {
    setData({ ...data, projects: data.projects.filter((_, i) => i !== index) });
  }

  const addProjectDescription = (projIndex: number) => {
    const newProjects = [...data.projects];
    newProjects[projIndex].description.push('');
    setData({ ...data, projects: newProjects });
  }

  const removeProjectDescription = (projIndex: number, descIndex: number) => {
    const newProjects = [...data.projects];
    newProjects[projIndex].description = newProjects[projIndex].description.filter((_, i) => i !== descIndex);
    setData({ ...data, projects: newProjects });
  }

  const handleSkillChange = (index: number, value: string) => {
    const newSkills = [...data.skills];
    newSkills[index] = value;
    setData({ ...data, skills: newSkills });
  };

  const addSkill = () => {
    setData({ ...data, skills: [...data.skills, ''] });
  };

  const removeSkill = (index: number) => {
    setData({ ...data, skills: data.skills.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white">Edit Profile: {data.name}</h2>
      <Input label="Profile Name" id="profileName" value={data.name} onChange={e => setData({ ...data, name: e.target.value })} />

      <Card>
        <h3 className="text-xl font-semibold mb-4">Contact Info</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Full Name" name="name" id="name" value={data.contact.name} onChange={handleContactChange} />
          <Input label="Email" name="email" id="email" type="email" value={data.contact.email} onChange={handleContactChange} />
          <Input label="Phone" name="phone" id="phone" value={data.contact.phone} onChange={handleContactChange} />
          <Input label="Location" name="location" id="location" value={data.contact.location} onChange={handleContactChange} />
          <Input label="LinkedIn URL" name="linkedin" id="linkedin" value={data.contact.linkedin || ''} onChange={handleContactChange} />
          <Input label="GitHub URL" name="github" id="github" value={data.contact.github || ''} onChange={handleContactChange} />
          <Input label="Website URL" name="website" id="website" value={data.contact.website} onChange={handleContactChange} />
        </div>
      </Card>

      <Card>
        <TextArea label="Professional Summary" id="summary" value={data.summary} onChange={handleSummaryChange} />
      </Card>

      <Card>
        <h3 className="text-xl font-semibold mb-4">Experience</h3>
        {data.experience.map((exp, expIndex) => (
          <div key={exp.id} className="mb-6 p-4 border border-gray-700 rounded-md">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
              <Input label="Role" value={exp.role} onChange={e => handleExperienceChange(expIndex, 'role', e.target.value)} />
              <Input label="Company" value={exp.company} onChange={e => handleExperienceChange(expIndex, 'company', e.target.value)} />
              <Input label="Location" value={exp.location} onChange={e => handleExperienceChange(expIndex, 'location', e.target.value)} />
              <Input label="Start Date" value={exp.startDate} onChange={e => handleExperienceChange(expIndex, 'startDate', e.target.value)} />
              <Input label="End Date" value={exp.endDate} onChange={e => handleExperienceChange(expIndex, 'endDate', e.target.value)} />
            </div>
            <div className="mt-2 space-y-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Responsibilities</label>
              {exp.responsibilities.map((resp, respIndex) => (
                <div key={respIndex} className="flex items-center gap-2">
                  <input className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-1.5 text-sm" value={resp} onChange={e => handleResponsibilityChange(expIndex, respIndex, e.target.value)} />
                  <Button variant="danger" className="px-2 py-1" onClick={() => removeResponsibility(expIndex, respIndex)}><TrashIcon /></Button>
                </div>
              ))}
              <Button variant="secondary" className="px-2 py-1" onClick={() => addResponsibility(expIndex)}><PlusIcon /> Add Responsibility</Button>
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="danger" onClick={() => removeExperience(expIndex)}><TrashIcon /> Remove Experience</Button>
            </div>
          </div>
        ))}
        <Button variant="secondary" onClick={addExperience}><PlusIcon /> Add Experience</Button>
      </Card>

      <Card>
        <h3 className="text-xl font-semibold mb-4">Projects</h3>
        {data.projects && data.projects.map((proj, projIndex) => (
          <div key={proj.id} className="mb-6 p-4 border border-gray-700 rounded-md">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
              <Input label="Project Name" value={proj.name} onChange={e => handleProjectChange(projIndex, 'name', e.target.value)} />
              <Input label="Live URL" value={proj.url} onChange={e => handleProjectChange(projIndex, 'url', e.target.value)} />
              <Input label="Repo URL" value={proj.repoUrl} onChange={e => handleProjectChange(projIndex, 'repoUrl', e.target.value)} />
            </div>
            <div className="mt-2 space-y-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
              {proj.description.map((desc, descIndex) => (
                <div key={descIndex} className="flex items-center gap-2">
                  <input className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-1.5 text-sm" value={desc} onChange={e => handleProjectDescriptionChange(projIndex, descIndex, e.target.value)} />
                  <Button variant="danger" className="px-2 py-1" onClick={() => removeProjectDescription(projIndex, descIndex)}><TrashIcon /></Button>
                </div>
              ))}
              <Button variant="secondary" className="px-2 py-1" onClick={() => addProjectDescription(projIndex)}><PlusIcon /> Add Description Point</Button>
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="danger" onClick={() => removeProject(projIndex)}><TrashIcon /> Remove Project</Button>
            </div>
          </div>
        ))}
        <Button variant="secondary" onClick={addProject}><PlusIcon /> Add Project</Button>
      </Card>

      <Card>
        <h3 className="text-xl font-semibold mb-4">Education</h3>
        {data.education.map((edu, eduIndex) => (
          <div key={edu.id} className="mb-6 p-4 border border-gray-700 rounded-md">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
              <Input label="Degree" value={edu.degree} onChange={e => handleEducationChange(eduIndex, 'degree', e.target.value)} />
              <Input label="Institution" value={edu.institution} onChange={e => handleEducationChange(eduIndex, 'institution', e.target.value)} />
              <Input label="Location" value={edu.location} onChange={e => handleEducationChange(eduIndex, 'location', e.target.value)} />
              <Input label="Graduation Date" value={edu.graduationDate} onChange={e => handleEducationChange(eduIndex, 'graduationDate', e.target.value)} />
              <Input label="GPA" value={edu.gpa} onChange={e => handleEducationChange(eduIndex, 'gpa', e.target.value)} />
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="danger" onClick={() => removeEducation(eduIndex)}><TrashIcon /> Remove Education</Button>
            </div>
          </div>
        ))}
        <Button variant="secondary" onClick={addEducation}><PlusIcon /> Add Education</Button>
      </Card>

      <Card>
        <h3 className="text-xl font-semibold mb-4">Skills</h3>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300 mb-1">Skills</label>
          {data.skills.map((skill, index) => (
            <div key={index} className="flex items-center gap-2">
              <input className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" value={skill} onChange={e => handleSkillChange(index, e.target.value)} />
              <Button variant="danger" className="px-2 py-1" onClick={() => removeSkill(index)}><TrashIcon /></Button>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Button variant="secondary" className="px-2 py-1" onClick={addSkill}><PlusIcon /> Add Skill</Button>
        </div>
      </Card>

      <div className="flex justify-end gap-4 mt-8">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(data)}>Save Changes</Button>
      </div>
    </div>
  );
};

export default ResumeEditor;
