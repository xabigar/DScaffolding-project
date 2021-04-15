
const {Project,ResourceAuthor,EvidenciableElement,Author,Glossary,Term,Extract,Problem,Cause,CauseMitigation,Consequence,ConsequenceAlleviation,Stakeholder,StakeholderGoal,Measurement,Practice,Activity,Tool,Property,DescribableElement,Artefact,Component,DesignDecision,KernelTheory,Requirement,FunctionalRequirement,NonFunctionalRequirement,Justification,Goal,Opportunity,RelatedWork,Evidence,Resource,AcademicResource,WebResource,Limitation} = require('./model.js');

const TransformationRules = {
  article (project){
    let that = this;
    let text = `
%Document generated using DScaffolding from `+project.url+`
\\documentclass{article}
\\usepackage[utf8]{inputenc}

\\newcommand{\\todo}[1] {\\iffalse #1 \\fi} %Use \\todo{} command for bringing ideas back to the mind map

\\title{`+project.name+`}
\\author{`+this.authors(project.authors)+`}

\\begin{document}

\\maketitle
      
`+this.introduction(project)+`
      
\\bibliographystyle{unsrt}
\\bibliography{references}

\\end{document}
    `;
    return text;
  },
  introduction (project){
    let text = `
\\section{Introduction}

%Describe the practice in which the problem addressed appears
`;
    if(project.practice!=null) text += this.practice(project.practice,project);
    text += `
    
%Describe the practical problem addressed, its significance and its causes
`;
    if(project.problem!=null) text += this.problem(project.problem,project.practice);
    text += `
    
%Summarise existing research including knowledge gaps and give an account for similar and/or alternative solutions to the problem
`;
    if(project.getCausesRelatedWork().length>0) text += this.relatedWorkGeneral(project.getCausesRelatedWork());
    text += `
    
%Formulate goals and present Kernel theories used as a basis for the artefact design
`;
    if(project.getCauseGoals().length>0) text += this.goals(project.getCauseGoals(),project.getCauseKernelTheories());
    text += `
    
%Describe the kind of artefact that is developed or evaluated
`;
    if(project.artefact!=null) text += this.artefact(project.artefact);
    text += `
    
%Formulate research questions
`;
    if(project.hasCompleteDesignProblem()) text += this.designProblem(project);
    text += `
    
%Summarize the contributions and their significance
`;
    if(project.contributionType!=null) text+= this.contribution(project.contributionType,project);
      text+=`
      
%Overview of the research strategies and methods used
This article has followed a Design Science Research approach.

%Describe the structure of the paper
The remainder of the paper is structured as follows: 

%Optional - illustrate the relevance and significance of the problem with an example
    `;
    return text;
  },
  authors (authors){
    let text = ``;
    for(var i=0;i<authors.length;i++){
      if(i>0&&i<authors.length-1) text += `, `;
      if(i>0&&i==authors.length-1) text += ` and `;
      text += authors.fullName;
    }
    return text;
  },
  practice (practice,project){
    let text = '';
    if(practice.hasRecentEvidences()){
      text += 'In recent years, there has been increasing interest in '+practice.text+'. ';
    }
    else if(practice.hasEvidences()){
      text += 'There is a growing body of literature that recognises the importance of '+practice.text+'. ';
    }
    if(project.glossary.hasTermWithDefinitions(practice.text)){
      if(practice.hasRecentEvidences()||practice.hasEvidences()){
        text += 'It is necessary here to clarify exactly what is meant by '+practice.text+'. '
      }
      text += this.definition(project.glossary.getTerm(practice.text));
    }
    for(let i=0;i<practice.properties.length;i++){
      text += this.practiceProperty(practice.properties[i],practice,i);
    }
    if(practice.activities.length>0) text += this.practiceActivities(practice.activities,practice);
    return text;
  },
  definition (glossary,termKey){
    let text = '';
    let term = glossary.getTerm(termKey);
    if(term.definitions.length>1){
      text += "Several definitions of "+term.key+" have been proposed. ";
    }
    for(let i=0;i<term.definitions.length;i++){
      if(term.definitions[i].resource == null){
        text += term.key+' can be defined as '+term.definitions[i].text+'.';
      }
      if(i==0 && term.definitions[i].resource.authors != null){
        text += 'According to '+this.resourceAuthor(term.definitions[i].resource)+', '+term.key+' can be defined as follows: "'+term.definitions[i].text+'" '+this.citation(term.definitions[i].resource)+'.';
      }
      else if(i==0){
        text += 'The term '+term.key+' is generally understood to mean "'+term.definitions[i].text+'" '+this.citation(term.definitions[i].resource)+'.';
      }
      else if(term.definitions[i].resource.author != null){
        text += 'A further definition of '+term.key+' is given by '+this.resourceAuthor(term.definitions[i].resource)+' who describes it as "'+term.definitions[i].text+'" '+this.citation(term.definitions[i].resource)+'.';
      }
      else{
        text += 'Alternatively, '+term.key+' can be defined as "'+term.definitions[i].text+'" '+this.citation(term.definitions[i].resource)+'.';
      }
    }
    return text;
  },
  practiceProperty (property, practice, n){
    let text = '';
    if(n==0){
      text += 'A key aspect of '+practice.text+' is that it is '+property.statement;
    }
    else if(n%2==0){
      text += property.statement+' is another important aspect of '+practice.text;
    }
    else{
      text += 'Apart from that, '+property.statement+' is a fundamental property of '+practice.text;
    }
    for(let ev in property.evidences){
      text += ' '+this.citation(property.evidences[ev].resource);
    }
    text += '. ';
    if(property.subproperties.length>0){
      text += this.practiceSubproperties(property.subproperties);
    }
    return text;
  },
  practiceSubproperties (subproperties){
    let text = 'With respect to this, it has been reported that ';
    for(let i=0;i<subproperties.length;i++){
      if(i>0&&i<subproperties.length-1){
        text += ', ';
      }
      else if(i>0&&i==subproperties.length-1){
        text += ' and ';
      }
      text += subproperties[i].statement;
      for(let ev in subproperties[i].evidences){
        text += ' '+this.citation(subproperties[i].evidences[ev].resource);
      }
    }
    text += '. ';
    return text;
  },
  practiceSubpropertiesInjection (subproperties){
    let text = ' Moreover, it has been reported that ';
    for(let i=0;i<subproperties.length;i++){
      if(i>0&&i<subproperties.length-1){
        text += ', ';
      }
      else if(i>0&&i==subproperties.length-1){
        text += ' and ';
      }
      text += subproperties[i].statement;
      for(let ev in subproperties[i].evidences){
        text += ' '+this.citation(subproperties[i].evidences[ev].resource);
      }
    }
    text += '. ';
    return text;
  },
  practiceActivities (activities, practice){
    let text = practice.text+' encompasses different activities: ';
    for(let i=0;i<activities.length;i++){
      if(i>0&&i<activities.length-1){
        text += ', ';
      }
      else if(i>0&&i==activities.length-1){
        text += ' and ';
      }
      text += activities[i].text;
    }
    text += '. ';
    for(let i=0;i<activities.length;i++){
      text += this.practiceActivity(activities[i],i);
    }
    return text;
  },
  practiceActivitiesInjection (activities, practice){
    let text = ' Moreover, '+practice.text+' comprisses ';
    for(let i=0;i<activities.length;i++){
      if(i>0&&i<activities.length-1){
        text += ', ';
      }
      else if(i>0&&i==activities.length-1){
        text += ' and ';
      }
      text += activities[i].text;
    }
    text += '. ';
    for(let i=0;i<activities.length;i++){
      text += this.practiceActivity(activities[i],i);
    }
    return text;
  },
  practiceActivity (activity, n){
    let text = '';
    if(activity.properties.length>0||activity.tools.length>0){
      if(n%3==0){
        text += 'As for '+activity.text+', ';
      }
      else if(n%3==1){
        text += 'As far as '+activity.text+' is concerned, ';
      }
      else{
        text += 'As regards '+activity.text+', ';
      }
      if(activity.properties.length>0){
        text += 'it has been described as '+this.activityProperties(activity.properties)+'. ';
        if(activity.tools.length>0){
          text += 'It is conducted using '+this.activityTooling(activity.tools)+'. ';
        }
      }
      else{
        text += 'it is conducted using '+this.activityTooling(activity.tools)+'. ';
      }
    }
    return text;
  },
  activityProperties (properties){
    let text = '';
    for(let i=0;i<properties.length;i++){
      if(i>0&&i<properties.length-1){
        text += ', ';
      }
      else if(i>0&&i==properties.length-1){
        text += ' and ';
      }
      text += properties[i].statement;
      for(let j=0;j<properties[i].evidences.length;j++){
        text += ' '+this.citation(properties[i].evidences[j].resource);
      }
    }
    return text;
  },
  activityTooling (tools){
    let text = '';
    for(let i=0;i<tools.length;i++){
      if(i>0&&i<tools.length-1){
        text += ', ';
      }
      else if(i>0&&i==tools.length-1){
        text += ' and ';
      }
      text += tools[i].text;
      if(tools[i].subtools.length>0){
        text += ' (such as ';
        text += this.subtools(tools[i].subtools);
        text += ')';
      }
    }
    return text;
  },
  subtools (subtools){
    let text = '';
    for(let i=0;i<subtools.length;i++){
      if(i>0&&i==subtools.length-1){
        text += ' and ';
      }
      else if(i>0&&i<subtools.length-1){
        text += ', ';
      }
      text += subtools[i].text;
    }
    return text;
  },
  problem (problem,practice){
    let text = '';
    if(problem.evidences.length>0){
      text += 'Research has shown that a major problem';
      if(practice!=null){
        text += ' within '+practice.text;
      }
      text += ' is that '+problem.statement;
      for(let ev in problem.evidences){
        text += ' '+this.citation(problem.evidences[ev].resource);
      }
    }
    else{
      text += 'A major problem'
      if(practice!=null){
        text += ' within '+practice.text;
      }
      text += ' is that '+problem.statement;
    }
    text += '. ';
    if(problem.getLeafConsequences().length>0) text += this.problemConsequences(problem.getLeafConsequences());
    if(problem.getLeafCauses().length>0) text += this.problemCauses(problem.getLeafCauses());
    return text;
  },
  problemConsequences (consequences){
    let text = '';
    let established = false;
    for(let c in consequences){
      if(consequences[c].evidences.length>0){
        established = true;
        break;
      }
    }
    text += 'This problem is of particular concern as it';
    if(established){
      text += ' is now well established that it';
    }
    text += ' can lead to ';
    for(let i=0;i<consequences.length;i++){
      if(i>0&&i<consequences.length-1){
        text += ', ';
      }
      else if(i>0&&i==consequences.length-1){
        text += ' and ';
      }
      text += consequences[i].statement;
      for(let ev in consequences[i].evidences){
        text += ' '+this.citation(consequences[i].evidences[ev].resource);
      }
    }
    text += '. ';
    return text;
  },
  problemCauses (causes){
    let text = '';
    if(causes.length==1){
      if(causes[0].evidences.length==0){
        text += causes[0].statement + ' can be a contributing factor to this problem';
      }
      else{
        text += causes[0].statement + ' has been shown to be related to this problem ';
        for(let ev in causes[0].evidences){
          text += this.citation(causes[0].evidences[ev].resource);
        }
      }
    }
    else{
      text += 'Causes can be diverse: ';
      for(let i=0;i<causes.length;i++){
        let j = i+1;
        if(i>0&&i<causes.length-1){
          text += ', ';
        }
        else if(i>0&&i==causes.length-1){
          text += ' and ';
        }
        text += '('+j+') '+causes[i].statement;
        for(let ev in causes[i].evidences){
          text += ' '+this.citation(causes[i].evidences[ev].resource);
        }
      }
    }
    text += '. '
    return text;
  },
  relatedWorkGeneral (relatedWorks){
    let text = '';
    text += 'Existing research has tackled these causes. '
    for(let rel in relatedWorks){
      text += this.relatedWork(relatedWorks[rel]);
    }
    return text;
  },
  relatedWork (relatedWork){
    let text = '';
    if(relatedWork.resource.authors!=null&&relatedWork.resource.authors.length>0){
      text += this.resourceAuthor(relatedWork.resource);
    }
    else{
      text += this.citation(relatedWork.resource);
    }
    text += ' addressed the '+relatedWork.opportunity.cause.statement;
    if(relatedWork.resource.authors!=null&&relatedWork.resource.authors.length>0){
      text += ' '+this.citation(relatedWork.resource);
    }
    text += '. ';
    if(relatedWork.limitations.length>0){
      text += this.relatedWorkLimitationsGeneral(relatedWork.limitations);
    }
    return text;
  },
  relatedWorkLimitationsGeneral (limitations){
    let text = '';
    text += 'However, this approach has the following limitation'
    if(limitations.length>1){
      text += 's';
    }
    text += ': ';
    text += this.relatedWorkLimitations(limitations);
    return text;
  },
  relatedWorkLimitations (limitations){
    let text = '';
    for(let i=0;i<limitations.length;i++){
      if(i>0&&i<limitations.length-1){
        text += ', ';
      }
      else if(i>0&&i==limitations.length-1){
        text += ' and ';
      }
      text += limitations[i].statement;
      for(let ev in limitations[i].evidences){
        text += ' '+this.citation(limitations[i].evidences[ev].resource);
      }
    }
    text += '. ';
    return text;
  },
  goals (goals,kernelTheories){
    let text = '';
    text += 'In this work, we address '+goals.length+' main cause';
    if(goals.length>1){
      text += 's';
    }
    text += ': ';
    for(let i=0;i<goals.length;i++){
      if(i>0&&i<goals.length-1){
        text += ', ';
      }
      else if(i>0&&i==goals.length-1){
        text += ' and ';
      }
      text += goals[i].opportunity.cause.statement;
    }
    text += '. ';
    if(kernelTheories.length>0){
      text += this.kernelTheories(kernelTheories,goals.length);
    }
    return text;
  },
  kernelTheories (kernelTheories,goalNum){
    let text = 'To lessen ';
    if(goalNum==1) text+= 'this';
    else text += 'these'
    text += ' cause'
    if(goalNum>1) text += 's';
    text +=', we resort to ';
    for(let i=0;i<kernelTheories.length;i++){
      if(i>0&&i<kernelTheories.length-1){
        text += ', ';
      }
      else if(i>0&&i==kernelTheories.length-1){
        text += ' and ';
      }
      text += kernelTheories[i].text;
    }
    text += '. ';
    return text;
  },
  artefact (artefact){
    let text = '';
    if(artefact.name!=null){
      text += 'This article presents an artefact named '+artefact.name+'. ';
    }
    else{
      text += 'This article presents a novel artefact';
    }
    if(artefact.description!=null){
      text += 'This artefact is a '+artefact.description+'. ';
    }
    return text;
  },
  designProblem (project){
    let text =  `In summary, along Wieringa's template \\cite{Wieringa2014}, this paper's design problem can be enunciated as follows: 
improve `;
    text += project.problem.statement;
    text += `
by designing a(n) `;
    text += project.artefact.description;
    text += `
that satisfies `;
    for(let i=0;i<project.artefact.requirements.length;i++){
      if(i>0&&i<project.artefact.requirements.length-1) text += ', ';
      else if(i>0&&i==project.artefact.requirements.length-1) text += ' and ';
      text += project.artefact.requirements[i].text;
    }
    text += `
in order to help `;
    let stG = [];
    for(let i=0;i<project.stakeholders.length;i++){
      if(project.stakeholders[i].goals.length==0) continue;
      let g = project.stakeholders[i].name+' achieve ';
      for(let j=0;j<project.stakeholders[i].goals.length;j++){
        if(j>0&&j<project.stakeholders[i].goals.length-2){
          g += ', ';
        }
        else if(j>0&&j==project.stakeholders[i].goals.length-2){
          g += ' and ';
        }
        g+= project.stakeholders[i].goals[j].statement;
      }
      stG.push(g);
    }
    if(stG.length==1) text += stG[0];
    else if(stG.length==2) text += stG.join(" and ");
    else text += stG.slice(0,stG.length-1).join(", ") + ' and ' + stG[stG.length-1];
    text += '. ';
    return text;
  },
  resourceAuthors (resource){

  },
  citation (resource){
    return '\\cite{'+this.resourceIdentifier(resource)+'}';
  },
  contribution (contributionType,project){
    let text;
    switch(contributionType){
      case "invention":
        text = 'The importance and originality of this study lie in the exploration of a complex problem space where little understanding exists. This work aims to contribute to its solution through the construction of a novel artefact. Consequently, this study can be classified as an invention along Gregor and Hevner’s DSR knowledge contribution framework \\cite{Gregor2013}.';
        break;
      case 'improvement':
        text = 'It is hoped that this research will contribute to a deeper understanding of '
        if(project.practice!=null) text += project.practice.text;
        else text += 'the practice'
        text+= '. We propose a solution aiming at complementing current approaches for solving '
        if(project.problem!=null) text += project.problem.statement;
        else text += 'the problem'
        text += '. Consequently, this study can be classified as an improvement along Gregor and Hevner’s DSR knowledge contribution framework \\cite{Gregor2013}.';
        break;
      case 'routineDesign':
        text = 'This study provides a solution for a well-known problem by applying existing design knowledge. Consequently, this study can be classified as a routine design along Gregor and Hevner’s DSR knowledge contribution framework \\cite{Gregor2013}.';
        break;
      case 'exaptation':
        text = 'The importance and originality of this study lie in the extension and refinement of existing design knowledge for adapting it to a problem context for which it was not originally intended. Consequently, this study can be classified as an exaptation along Gregor and Hevner’s DSR knowledge contribution framework \\cite{Gregor2013}.'
        break;
    }
    return text;

  },
  resource (resource){
    if(resource instanceof AcademicResource){
      return this.academicResource(resource);
    }
    else if(resource instanceof WebResource){
      return this.webResource(resource);
    }
  },
  webResource (resource){
    let text = '@misc{'+this.webResourceIdentifier(resource)+`,
  note = {`+resource.url;
    if(resource.accessedDate!=null){
      text += ' (accessed: '+resource.accessedDate.toDateString()+`)`;
    }
    text += `}
}`;
    return text;
  },
  academicResource (resource){
    let text = '';
    let resourceId = this.academicResourceIdentifier(resource)+',';
    switch(resource.type){
      case 'journal':
        text += '@article{'+resourceId;
        if(resource.source!=null){
          if(text.charAt(text.length-1)=='}') {
            text += ',';
          }
          text += `
  journal = {`+resource.source+'}';
        }
        break;
      case 'book':
        text += '@book{'+resourceId;
        break;
      case 'book_section':
        if(resource.source!=null){
          text += '@incollection{'+resourceId;
          if(text.charAt(text.length-1)=='}') {
            text += ',';
          }
          text += `
  booktitle = {`+resource.source+'}';
        }
        else{
          text += '@inbook{'+resourceId;
        }
        break;
      case 'conference_proceedings':
        text += '@inproceedings{'+resourceId;
        if(resource.source!=null){
          if(text.charAt(text.length-1)=='}') {
            text += ',';
          }
          text += `
  booktitle = {`+resource.source+'}';
        }
        break;
      case 'working_paper':
        text += '@unpublished{'+resourceId;
        break;
      case 'report':
        text += '@techreport{'+resourceId;
        break;
      case 'thesis':
        text += '@phdthesis{'+resourceId;
        break;
      case 'magazine_article':
        text += '@article{'+resourceId;
        if(resource.source!=null){
          if(text.charAt(text.length-1)=='}') {
            text += ',';
          }
          text += `
  journal = {`+resource.source+'}';
        }
        break;
      case null:
        text += '@article{'+resourceId;
        break;
      default:
        text += '@misc{'+resourceId;
    }
    if(resource.title!=null){
      if(text.charAt(text.length-1)=='}') {
        text += ',';
      }
      text += `
  title = {`+resource.title+'}';
    }
    if(resource.authors!=null&&resource.authors.length>0){
      if(text.charAt(text.length-1)=='}') {
        text += ',';
      }
      text += `
  author = {`;
      for(let i=0;i<resource.authors.length;i++){
        if(i>0) text += ' and ';
        if(resource.authors[i].firstName!=null) text += resource.authors[i].firstName;
        if(resource.authors[i].firstName!=null&&resource.authors[i].lastName!=null) text += " ";
        if(resource.authors[i].lastName!=null) text += resource.authors[i].lastName;
      }
      text += '}';
    }
    if(resource.year!=null){
      if(text.charAt(text.length-1)=='}') {
        text += ',';
      }
      text += `
  year = {`+resource.year+'}';
    }
    if(resource.month!=null){
      if(text.charAt(text.length-1)=='}') {
        text += ',';
      }
      text += `
  month = {`+resource.month+'}';
    }
    if(resource.pages!=null){
      if(text.charAt(text.length-1)=='}') {
        text += ',';
      }
      let pages;
      let regExp = /--/;
      if(regExp.test(resource.pages)) pages = resource.pages;
      else pages = resource.pages.replace(/-/,"--");
      text += `
  pages = {`+pages+'}';
    }
    if(resource.volume!=null){
      if(text.charAt(text.length-1)=='}') {
        text += ',';
      }
      text += `
  volume = {`+resource.volume+'}';
    }
    if(resource.publisher!=null){
      if(text.charAt(text.length-1)=='}') {
        text += ',';
      }
      text += `
  publisher = {`+resource.publisher+'}';
    }
    if(resource.edition!=null){
      if(text.charAt(text.length-1)=='}') {
        text += ',';
      }
      text += `
  edition = {`+resource.edition+'}';
    }
    if(resource.institution!=null){
      if(text.charAt(text.length-1)=='}') {
        text += ',';
      }
      text += `
  institution = {`+resource.institution+'}';
    }
    if(resource.series!=null){
      if(text.charAt(text.length-1)=='}') {
        text += ',';
      }
      text += `
  series = {`+resource.series+'}';
    }
    if(resource.chapter!=null){
      if(text.charAt(text.length-1)=='}') {
        text += ',';
      }
      text += `
  chapter = {`+resource.chapter+'}';
    }
    if(resource.editors!=null&&resource.editors.length>0){
      if(text.charAt(text.length-1)=='}') {
        text += ',';
      }
      text += `
  editor = {`;
      for(let i=0;i<resource.editors.length;i++){
        if(i>0) text += ' and ';
        if(resource.editors[i].firstName!=null) text += resource.editors[i].firstName;
        if(resource.editors[i].firstName!=null&&resource.editors[i].lastName!=null) text += " ";
        if(resource.editors[i].lastName!=null) text += resource.editors[i].lastName;
      }
      text += '}';
    }
    if(resource.language!=null){
      if(text.charAt(text.length-1)=='}') {
        text += ',';
      }
      text += `
  language = {`+resource.language+'}';
    }
    if(resource.doi!=null){
      if(text.charAt(text.length-1)=='}') {
        text += ',';
      }
      text += `
  doi = {`+resource.doi+'}';
    }
    if(resource.issn!=null){
      if(text.charAt(text.length-1)=='}') {
        text += ',';
      }
      text += `
  issn = {`+resource.issn+'}';
    }
    if(resource.isbn!=null){
      if(text.charAt(text.length-1)=='}') {
        text += ',';
      }
      text += `
  isbn = {`+resource.isbn+'}';
    }
    if(resource.city!=null){
      if(text.charAt(text.length-1)=='}') {
        text += ',';
      }
      text += `
  city = {`+resource.city+'}';
    }
    if(resource.country!=null){
      if(text.charAt(text.length-1)=='}') {
        text += ',';
      }
      text += `
  country = {`+resource.country+'}';
    }
    if(resource.issue!=null){
      if(text.charAt(text.length-1)=='}') {
        text += ',';
      }
      text += `
  number = {`+resource.issue+'}';
    }
    if(resource.websites!=null&&resource.websites.length>0){
      if(text.charAt(text.length-1)=='}') {
        text += ',';
      }
      text += `
  url = {`+resource.websites[0]+'}';
    }
    text += `
}`;
    return text;
  },
  resourceIdentifier (resource){
    if(resource instanceof AcademicResource){
      return this.academicResourceIdentifier(resource);
    }
    else if(resource instanceof WebResource){
      return this.webResourceIdentifier(resource);
    }
  },
  academicResourceIdentifier (resource){
    if(resource.authors.length>0&&resource.year!=null){
      return resource.authors[0].lastName+resource.year;
    }
    else if(resource.authors.length>0){
      let res = resource.authors[0].lastName+resource.title.split(" ")[0]+resource.title.split(" ")[1];
      return res.replace(/,/g,"");
    }
    else{
      let res = resource.title.split(" ")[0]+resource.title.split(" ")[1];
      return res.replace(/,/g,"");
    }
  },
  webResourceIdentifier (resource){
    let regexp = /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n?]+)/im
    let m = resource.url.match(regexp);
    return m[1];
  },
  bibliography (project){
    let text = `
@book{Wieringa2014,
  title={Design science methodology for information systems and software engineering},
  author={Wieringa, Roel J},
  year={2014},
  publisher={Springer}
}
@article{Gregor2013,
  title={Positioning and presenting design science research for maximum impact},
  author={Gregor, Shirley and Hevner, Alan R},
  journal={MIS quarterly},
  volume={37},
  number={2},
  year={2013}
}
    `;
    let bib = project.getBibliography();
    let insertedBib = ["Wieringa2014","Gregor2013"];
    for(let i=0;i<bib.length;i++){
      if(bib[i]==null) continue;
      if(insertedBib.indexOf(this.resourceIdentifier(bib[i]))==-1){
        text += '\n'+this.resource(bib[i]);
        insertedBib.push(this.resourceIdentifier(bib[i]));
      }
    }
    return text;
  },
  resourceAuthor (resource){
    let text = resource.authors[0].lastName;
    if(resource.authors.length>0){
      text += ' et al.';
    }
    return text;
  }
}

module.exports = TransformationRules
