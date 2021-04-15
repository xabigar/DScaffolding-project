
class Project {
  constructor(name,url){
    this._name = name;
    this._problem = null;
    this._glossary = new Glossary();
    this._authors = [];
    this._contributionType = null;
    this._url = url;
    this._artefact = null;
    this._practice = null;
    this._stakeholders = [];
  }
  insertStakeholder(stakeholder){
    this._stakeholders.push(stakeholder);
  }
  get stakeholders(){
    return this._stakeholders;
  }
  set name(name){
    this._name = name;
  }
  get name(){
    return this._name;
  }
  set practice(practice){
    this._practice = practice;
  }
  get practice(){
    return this._practice;
  }
  get url(){
    return this._url;
  }
  set problem(problem){
    this._problem = problem;
  }
  get problem(){
    return this._problem;
  }
  set artefact(artefact){
    this._artefact = artefact;
  }
  get artefact(){
    return this._artefact;
  }
  get contributionType(){
    return this._contributionType;
  }
  set contributionType(contributionType){
    this._contributionType = contributionType;
  }
  get glossary(){
    return this._glossary;
  }
  set glossary(glossary){
    this._glossary = glossary;
  }
  insertAuthor(author){
    this._authors.push(author);
  }
  get authors(){
    return this._authors;
  }
  getCausesRelatedWork(){
    let causesRelatedWork = [];
    let getCauseRelatedWork = (cause) => {
      let rw = [];
      if (cause.mitigation != null && cause.mitigation.relatedWork != null) rw = rw.concat(cause.mitigation.relatedWork);
      for(let c in cause.subcauses){
        rw = rw.concat(getCauseRelatedWork(cause.subcauses[c]));
      }
      return rw;
    }
    if(this.problem!=null){
      for(let c in this.problem.causes){
        causesRelatedWork = causesRelatedWork.concat(getCauseRelatedWork(this.problem.causes[c]));
      }
    }
    return causesRelatedWork;
  }
  getCauseGoals(){
    let causeGoals = [];
    const getGoals = (cause) => {
        let goals = [];
        if(cause.mitigation!=null&&cause.mitigation.goal!=null) goals = [cause.mitigation.goal];
        for(let c in cause.subcauses){
          goals = goals.concat(getGoals(cause.subcauses[c]));
        }
        return goals;
    }
    if(this.problem!=null){
      for(let c in this.problem.causes){
        causeGoals = causeGoals.concat(getGoals(this.problem.causes[c]));
      }
    }
    return causeGoals;
  }
  hasCompleteDesignProblem(){
    if(this.problem==null||this.problem.statement==null) return false;
    if(this.artefact==null||this.artefact.description==null) return false;
    if(this.artefact.requirements.length==0) return false;
    if(this.stakeholders.map((st) => {return st.goals}).length==0) return false;
    return true;
  }
  getCauseKernelTheories(){
    let causeKernelTheories = [];
    let causeGoals = this.getCauseGoals();
    let getGoalKernelTheories = (goal) => {
      let kt = goal.kernelTheories;
      for(let i=0;i<goal.subgoals.length;i++){
        kt = kt.concat(getGoalKernelTheories(goal.subgoals[i]));
      }
      return kt;
    }
    for(let i=0;i<causeGoals.length;i++){
      causeKernelTheories = causeKernelTheories.concat(getGoalKernelTheories(causeGoals[i]));
    }
    if(this._artefact!=null){
      for(let i=0;i<this._artefact.components.length;i++){
        for(let j=0;j<this._artefact.components[i].designDecisions.length;j++){
          causeKernelTheories = causeKernelTheories.concat(this._artefact.components[i].designDecisions[j].kernelTheories);
        }
      }
    }
    return causeKernelTheories;
  }
  getBibliography(){
    let bibliography = [];
    if(this.glossary!=null) bibliography = bibliography.concat(this.glossary.getBibliography());
    if(this.problem!=null) bibliography = bibliography.concat(this.problem.getBibliography());
    if(this.practice!=null) bibliography = bibliography.concat(this.practice.getBibliography());
    let relatedWork = this.getCausesRelatedWork();
    bibliography = bibliography.concat(relatedWork.map((el) => {return el.evidence.resource}));
    for(let i=0;i<relatedWork.length;i++){
      let ev = relatedWork[i].limitations.map((el) => {return el.evidences});
      for(let j=0;j<ev.length;j++){
        bibliography = bibliography.concat(ev.map((ev) => {return ev.resource}));
      }
    }
    return bibliography;
  }
}

class EvidenciableElement{
  constructor(){
    this._evidences = [];
  }
  insertEvidence(evidence){
    this._evidences.push(evidence);
  }
  get evidences(){
    return this._evidences;
  }
}

class Glossary {
  constructor(){
    this._terms = [];
  }
  insertTerm (term){
    this._terms.push(term);
  }
  get terms(){
    return this._terms;
  }
  hasTerm (key){
    return this._terms.map(term => term.key).indexOf(key)!=-1;
  }
  hasTermWithDefinitions (key){
    return this._terms.find((el) => {return el.key==key&&el.definitions.length>0})!=null;
  }
  getTerm (key){
    return this._terms.find(term => term.key==key);
  }
  getBibliography(){
    let bibliography = [];
    for(let i=0;i<this.terms.length;i++){
      bibliography = bibliography.concat(this.terms[i].getBibliography());
    }
    return bibliography;
  }
}

class Term {
  constructor(key){
    this._key = key;
    this._definitions = [];
  }
  insertDefinition(definition){
    this._definitions.push(definition);
  }
  get definitions(){
    return this._definitions;
  }
  get key(){
    return this._key;
  }
  getBibliography(){
    return this.definitions.map((el) => {return el.resource});
  }
}

class Author {
  constructor(fullName,email){
    this._fullName = fullName;
    this._email = email;
  }
}

class Problem extends EvidenciableElement{
  constructor(statement){
    super();
    this._statement = statement;
    this._causes = [];
    this._consequences = [];
  }
  get causes(){
    return this._causes;
  }
  insertCause(cause){
    this._causes.push(cause);
  }
  get consequences(){
    return this._consequences;
  }
  insertConsequence(consequence){
    this._consequences.push(consequence);
  }
  getLeafConsequences (){
    let leafConsequences = [];
    const getConsLeafConsequences = (cons) =>{
      let lc = [];
      if(cons.subconsequences.length==0) return [cons];
      else{
        for(let j=0;j<cons.subconsequences.length;j++){
          lc = lc.concat(getConsLeafConsequences(cons.subconsequences[j]));
        }
        return lc;
      }
    }
    for(let i=0;i<this.consequences.length;i++){
      leafConsequences = leafConsequences.concat(getConsLeafConsequences(this.consequences[i]));
    }
    return leafConsequences;
  }
  getLeafCauses (){
    let leafCauses = [];
    const getCauseLeafCauses = (cause) => {
      let lc = [];
      if(cause.subcauses.length==0) return [cause];
      else{
        for(let j=0;j<cause.subcauses.length;j++){
          lc = lc.concat(getCauseLeafCauses(cause.subcauses[j]));
        }
        return lc;
      }
    }
    for(let i=0;i<this.causes.length;i++){
      leafCauses = leafCauses.concat(getCauseLeafCauses(this.causes[i]));
    }
    return leafCauses;
  }
  get statement(){
    return this._statement;
  }
  getBibliography(){
    let bibliography = [];
    bibliography = bibliography.concat(this.evidences.map((el) => {return el.resource}));
    let leafCauses = this.getLeafCauses();
    for(let i=0;i<leafCauses.length;i++){
      bibliography = bibliography.concat(leafCauses[i].evidences.map((el) => {return el.resource}));
    }
    let leafConsequences = this.getLeafConsequences();
    for(let i=0;i<leafConsequences.length;i++){
      bibliography = bibliography.concat(leafConsequences[i].evidences.map((el) => {return el.resource}));
    }
    return bibliography;
  }
}

class Stakeholder extends EvidenciableElement{
  constructor(name,type){
    super();
    this._name = name;
    this._type = type;
    this._goals = [];
    this._evidences = [];
  }
  insertGoal(goal){
    this._goals.push(goal);
  }
  get goals(){
    return this._goals;
  }
  get name(){
    return this._name;
  }
  get type(){
    return this._type;
  }
}

class StakeholderGoal extends EvidenciableElement{
  constructor(statement){
    super();
    this._statement = statement;
    this._measurements = [];
  }
  get statement(){
    return this._statement;
  }
  get measurements(){
    return this._measurements;
  }
  insertMeasurement(measurement){
    this._measurements.push(measurement);
  }
}

class Measurement extends EvidenciableElement{
  constructor(statement){
    super();
    this._statement = statement;
  }
  get statement(){
    return this._statement;
  }
}

class Cause extends EvidenciableElement{
  constructor(statement){
    super();
    this._statement = statement;
    this._mitigation = null;
    this._subcauses = [];
  }
  get statement(){
    return this._statement;
  }
  insertSubcause(subcause){
    this._subcauses.push(subcause);
  }
  get subcauses(){
    return this._subcauses;
  }
  set mitigation(mitigation){
    mitigation.cause = this;
    this._mitigation = mitigation;
  }
  get mitigation(){
    return this._mitigation;
  }
}

class Consequence extends EvidenciableElement{
  constructor(statement){
    super();
    this._statement = statement;
    this._alleviation = null;
    this._subconsequences = [];
  }
  get statement(){
    return this._statement;
  }
  insertSubconsequence(subconsequence){
    this._subconsequences.push(subconsequence);
  }
  get subconsequences(){
    return this._subconsequences;
  }
  set alleviation(alleviation){
    alleviation.consequence = this;
    this._alleviation = alleviation;
  }
  get alleviation(){
    return this._alleviation;
  }
}

class Opportunity {
  constructor(statement){
    this._statement = statement;
    this._relatedWork = [];
    this._goal = null;
  }
  get statement(){
    return this._statement;
  }
  insertRelatedWork(relatedWork){
    relatedWork.opportunity = this;
    this._relatedWork.push(relatedWork);
  }
  get relatedWork(){
    return this._relatedWork;
  }
  set goal(goal){
    goal.opportunity = this;
    this._goal = goal;
  }
  get goal(){
    return this._goal;
  }
}

class Goal{
  constructor(statement){
    this._statement = statement;
    this._subgoals = [];
    this._opportunity = null;
    this._kernelTheories = [];
  }
  set opportunity(opportunity){
    this._opportunity = opportunity;
  }
  get opportunity(){
    return this._opportunity;
  }
  get statement(){
    return this._statement;
  }
  get subgoals(){
    return this._subgoals;
  }
  insertSubgoal(subgoal){
    this._subgoals.push(subgoal);
  }
  insertKernelTheory(kernelTheory){
    this._kernelTheories.push(kernelTheory);
  }
  get kernelTheories(){
    return this._kernelTheories;
  }
}

class RelatedWork extends EvidenciableElement {
  constructor(resource,evidence,limitations){
    super();
    this._resource = resource;
    this._evidence = evidence;
    this._limitations = limitations;
    this._opportunity = null;
  }
  get resource(){
    return this._resource;
  }
  get evidence(){
    return this._evidence;
  }
  get limitations(){
    return this._limitations;
  }
  set opportunity(opportunity){
    this._opportunity = opportunity;
  }
  get opportunity(){
    return this._opportunity;
  }
}

class Limitation extends EvidenciableElement{
  constructor(statement){
    super();
    this._statement = statement;
  }
  get statement(){
    return this._statement;
  }
}

class CauseMitigation extends Opportunity{
  constructor(statement){
    super(statement);
    this._cause = null;
  }
  set cause(cause){
    this._cause = cause;
  }
  get cause(){
    return this._cause;
  }
}

class ConsequenceAlleviation extends Opportunity{
  constructor(statement){
    super(statement);
    this._consequence = null;
  }
  set consequence(consequence){
    this._consequence = consequence;
  }
  get consequence(){
    return this._consequence;
  }
}

class DescribableElement{
  constructor(){
    this._properties = [];
  }
  get properties(){
    return this._properties;
  }
  insertProperty(property){
    this._properties.push(property);
    property.element = this;
  }
}

class Practice extends DescribableElement{
  constructor(text){
    super();
    this._text = text;
    this._generalization = null;
    this._activities = [];
  }
  get text(){
    return this._text;
  }
  get generalization(){
    return this._generalization;
  }
  set generalization(generalization){
    this._generalization = generalization;
  }
  get activities(){
    return this._activities;
  }
  insertActivity(activity){
    this._activities.push(activity);
  }
  hasRecentEvidences(){
    const recentThreshold = 5;
    const currentYear = new Date().getFullYear();
    for(let prop in this._properties){
      for(let ev in this._properties[prop].evidences){
        if(this._properties[prop].evidences[ev].year!=null&&currentYear-parseInt(this._properties[prop].evidences[ev].year)<recentThreshold) return true;
      }
    }
    return false;
  }
  hasEvidences(){
    for(let prop in this._properties){
      if(this._properties[prop].evidences.length>0) return true;
    }
    return false;
  }
  getBibliography(){
    let bibliography = [];
    for(let i=0;i<this.properties.length;i++){
      bibliography = bibliography.concat(this.properties[i].getBibliography());
    }
    for(let i=0;i<this.activities.length;i++){
      bibliography = bibliography.concat(this.activities[i].getBibliography());
    }
    return bibliography;
  }
}

class Property extends EvidenciableElement{
  constructor(statement){
    super();
    this._statement = statement;
    this._subproperties = [];
    this._element = null;
  }
  get statement(){
    return this._statement;
  }
  insertSubproperty(subproperty){
    this._subproperties.push(subproperty);
  }
  get subproperties(){
    return this._subproperties;
  }
  set element(element){
    this._element = element;
  }
  get element(){
    return this._element;
  }
  getBibliography(){
    let bibliography = [];
    bibliography = bibliography.concat(this.evidences.map((el) => {return el.resource}));
    for(let i=0;i<this.subproperties.length;i++){
      bibliography = bibliography.concat(this.subproperties[i].getBibliography());
    }
    return bibliography;
  }
}

class Activity extends DescribableElement{
  constructor(text){
    super();
    this._text = text;
    this._tools = [];
    this._subactivities = [];
  }
  get text(){
    return this._text;
  }
  insertTool(tool){
    this._tools.push(tool);
  }
  get tools(){
    return this._tools;
  }
  insertSubactivity(subactivity){
    this._subactivities.push(subactivity);
  }
  get subactivities(){
    return this._subactivities;
  }
  getBibliography(){
    let bibliography = [];
    for(let i=0;i<this.properties.length;i++){
      bibliography = bibliography.concat(this.properties[i].getBibliography());
    }
    for(let i=0;i<this.subactivities.length;i++){
      bibliography = bibliography.concat(this.subactivities[i].getBibliography());
    }
    return bibliography;
  }
}

class Tool extends DescribableElement{
  constructor(text){
    super();
    this._text = text;
    this._subtools = [];
  }
  get text(){
    return this._text;
  }
  insertSubtool(subtool){
    this._subtools.push(subtool);
  }
  get subtools(){
    return this._subtools;
  }
}

class Artefact{
  constructor(name,description){
    this._name = name;
    this._description = description;
    this._components = [];
    this._requirements = [];
  }
  get name(){
    return this._name;
  }
  get description(){
    return this._description;
  }
  insertComponent(component){
    this._components.push(component);
  }
  get components(){
    return this._components;
  }
  get requirements(){
    return this._requirements;
  }
  insertRequirement(requirement){
    this._requirements.push(requirement);
  }
}

class Component{
  constructor(name,description){
    this._name = name;
    this._description = description;
    this._requirements = [];
    this._designDecisions = [];
  }
  get name(){
    return this._name;
  }
  get description(){
    return this._description;
  }
  get requirements(){
    return this._requirements;
  }
  get designDecisions(){
    return this._designDecisions;
  }
  insertRequirement(requirement){
    this._requirements.push(requirement);
  }
  insertDesignDecision(designDecision){
    this._designDecisions.push(designDecision)
  }
}

class Requirement{
  constructor(text){
    this._text = text;
  }
  get text(){
    return this._text;
  }
}

class NonFunctionalRequirement extends Requirement{
  constructor(text,category){
    super(text);
    this._category = category;
    this._justifications = [];
  }
  get category(){
    return this._category;
  }
  insertJustification(justification){
    this._justifications.push(justification);
  }
  get justifications(){
    return this._justifications;
  }
}

class Justification extends EvidenciableElement{
  constructor(statement){
    super();
    this._statement = statement;
  }
  get statement(){
    return this._statement;
  }
}

class FunctionalRequirement extends Requirement{
  constructor(text){
    super(text);
    this._goal = null;
  }
  get goal(){
    return this._goal;
  }
  set goal(goal){
    this._goal = goal;
  }
}

class DesignDecision{
  constructor(text,requirement){
    this._text = text;
    this._requirement = requirement;
    this._kernelTheories = [];
  }
  get text(){
    return this._text;
  }
  get requirement(){
    return this._requirement;
  }
  insertKernelTheory(kernelTheory){
    this._kernelTheories.push(kernelTheory);
  }
  get kernelTheories(){
    return this._kernelTheories;
  }
}

class KernelTheory{
  constructor(text){
    this._text = text;
    this._extracts = [];
  }
  get text(){
    return this._text;
  }
  insertExtract(extract){
    this._extracts.push(extract);
  }
  get extracts(){
    return this._extracts
  }
}

class Extract{
  constructor(text) {
    this._text = text;
    this._resource = null;
  }
  get text(){
    return this._text;
  }
  get resource(){
    return this._resource;
  }
  set resource(resource){
    this._resource = resource;
  }
}

class Evidence extends Extract{
  constructor(text){
    super(text);
  }
}

class Resource{}

class AcademicResource extends Resource{
  constructor(title,type){
    super();
    this._title = title;
    this._type = type;
    this._authors = [];
    this._year = null;
    this._source = null;
    this._abstract = null;
    this._url = null;
    this._month = null;
    this._revision = null;
    this._pages = null;
    this._volume = null;
    this._issue = null;
    this._websites = [];
    this._publisher = null;
    this._city = null;
    this._edition = null;
    this._institution = null;
    this._series = null;
    this._chapter = null;
    this._editors = [];
    this._citationKey = null;
    this._language = null;
    this._country = null;
    this._doi = null;
    this._arxiv = null;
    this._isbn = null;
    this._issn = null;
    this._pmid = null;
    this._scopus = null;
    this._ssrn = null;
    this._keywords = [];
  }
  get month(){
    return this._month;
  }
  set month(month){
    this._month = month;
  }
  get revision(){
    return this._revision;
  }
  set revision(revision){
    this._revision = revision;
  }
  get pages(){
    return this._pages;
  }
  set pages(pages){
    this._pages = pages;
  }
  get volume(){
    return this._volume;
  }
  set volume(volume){
    this._volume = volume;
  }
  get issue(){
    return this._issue;
  }
  set issue(issue){
    this._issue = issue;
  }
  get publisher(){
    return this._publisher;
  }
  set publisher(publisher){
    this._publisher = publisher;
  }
  get city(){
    return this._city;
  }
  set city(city){
    this._city = city;
  }
  get edition(){
    return this._edition;
  }
  set edition(edition){
    this._edition = edition;
  }
  get institution(){
    return this._institution;
  }
  set institution(institution){
    this._institution = institution;
  }
  get series(){
    return this._series;
  }
  set series(series){
    this._series = series;
  }
  get chapter(){
    return this._chapter;
  }
  set chapter(chapter){
    this._chapter = chapter;
  }
  get citationKey(){
    return this._citationKey;
  }
  set citationKey(citationKey){
    this._citationKey = citationKey;
  }
  get language(){
    return this._language;
  }
  set language(language){
    this._language = language;
  }
  get country(){
    return this._country;
  }
  set country(country){
    this._country = country;
  }
  get doi(){
    return this._doi;
  }
  set doi(doi){
    this._doi = doi;
  }
  get arxiv(){
    return this._arxiv;
  }
  set arxiv(arxiv){
    this._arxiv = arxiv;
  }
  get isbn(){
    return this._isbn;
  }
  set isbn(isbn){
    this._isbn = isbn;
  }
  get issn(){
    return this._issn;
  }
  set issn(issn){
    this._issn = issn;
  }
  get pmid(){
    return this._pmid;
  }
  set pmid(pmid){
    this._pmid = pmid;
  }
  get scopus(){
    return this._scopus;
  }
  set scopus(scopus){
    this._scopus = scopus;
  }
  get ssrn(){
    return this._ssrn;
  }
  set ssrn(ssrn){
    this._ssrn = ssrn;
  }
  insertKeyword (keyword){
    this._keywords.push(keyword);
  }
  get keywords(){
    return this._keywords;
  }
  insertEditor (editors){
    this._editors.push(editors);
  }
  get editors(){
    return this._editors;
  }
  insertWebsite (website){
    this._websites.push(website);
  }
  get websites(){
    return this._websites;
  }
  get title(){
    return this._title;
  }
  get authors(){
    return this._authors;
  }
  insertAuthor (author){
    this._authors.push(author);
  }
  get year(){
    return this._year;
  }
  set year(year){
    this._year = year;
  }
  get source(){
    return this._source;
  }
  set source(source){
    this._source = source;
  }
  get abstract(){
    return this._abstract;
  }
  set abstract(abstract){
    this._abstract = abstract;
  }
  get url(){
    return this._url;
  }
  set url(url){
    this._url = url;
  }
  get type(){
    return this._type;
  }
}

class WebResource extends Resource{
  constructor(url,accessedDate){
    super();
    this._url = url;
    this._accessedDate = accessedDate;
  }
  get url(){
    return this._url;
  }
  get accessedDate(){
    return this._accessedDate;
  }
}

class ResourceAuthor {
  constructor(firstName,lastName){
    this._firstName = firstName;
    this._lastName = lastName;
  }
  get firstName(){
    return this._firstName;
  }
  get lastName(){
    return this._lastName;
  }
}

module.exports = {Project,ResourceAuthor,EvidenciableElement,Author,Glossary,Term,Extract,Problem,Cause,CauseMitigation,Consequence,ConsequenceAlleviation,Stakeholder,StakeholderGoal,Measurement,Practice,Activity,Tool,Property,DescribableElement,Artefact,Component,DesignDecision,KernelTheory,Requirement,FunctionalRequirement,NonFunctionalRequirement,Justification,Goal,Opportunity,RelatedWork,Evidence,Resource,AcademicResource,WebResource,Limitation};
