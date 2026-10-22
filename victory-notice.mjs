/** Small accessible public victory notice; all text arrives from verified domain rules. */
export function createVictoryNotice({title,message}, {collective=false}={}){
 const section=document.createElement('aside');
 section.className='victory-notice'+(collective?' victory-notice-collective':'');
 section.setAttribute('aria-label',collective?'Félicitations collectives':'Félicitations après une victoire');
 const icon=document.createElement('span');
 icon.className='victory-notice-symbol';
 icon.setAttribute('aria-hidden','true');
 icon.textContent=collective?'★':'🏆';
 const content=document.createElement('div');
 const heading=document.createElement(collective?'h2':'h4');
 heading.textContent=title;
 const paragraph=document.createElement('p');
 paragraph.textContent=message;
 content.append(heading,paragraph);section.append(icon,content);
 return section;
}
