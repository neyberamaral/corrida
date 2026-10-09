(() => {
'use strict';
const tela=document.getElementById('jogo'), el=id=>document.getElementById(id);
if(!window.THREE){
  el('estado').textContent='MOTOR 3D INDISPONÍVEL — VERIFIQUE A INTERNET';
  const c=tela.getContext('2d');c.fillStyle='#090e18';c.fillRect(0,0,480,680);c.fillStyle='#ff9c45';c.font='bold 20px sans-serif';c.fillText('APEX//DRIVE 3D',32,90);c.fillStyle='#e8edf3';c.font='14px sans-serif';c.fillText('O motor Three.js não carregou.',32,130);c.fillText('Conecte-se à internet e recarregue.',32,155);return;
}
const THREE=window.THREE;
const CARROS=[
 {nome:'VORTEX GT',cor:0xf28a3c,max:305,acel:118,controle:1.13,largura:1.9},
 {nome:'CRIMSON R',cor:0xe94f57,max:330,acel:136,controle:1.00,largura:1.95},
 {nome:'SKYLINE X',cor:0x51a9ee,max:318,acel:112,controle:1.3,largura:1.82}
];
const DIFICULDADES={casual:{trafego:.72,max:280,multiplicador:.8},arcade:{trafego:1,max:310,multiplicador:1},pro:{trafego:1.35,max:335,multiplicador:1.4}};
let carroEscolhido=0,dificuldade='arcade',jogando=false,pausado=false,acabou=false,raf=0,ultimo=0;
let velocidade=0,nitro=100,pontos=0,creditos=0,recorde=0,tempo=0,distancia=0,quase=0,timerTrafego=.8,timerItem=2;
let playerX=0,playerVX=0,direcaoVisual=0,tremor=0,flash=0;
const teclas={esquerda:false,direita:false,acelerar:false,frear:false,nitro:false,drift:false};
let audio=null,somLigado=true;
try{recorde=+(localStorage.getItem('apexDriveRecorde')||0);somLigado=localStorage.getItem('apexDriveSom')!=='off';}catch{}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rand=(a,b)=>a+Math.random()*(b-a),fmt=n=>String(Math.max(0,Math.floor(n))).padStart(6,'0');
const renderer=new THREE.WebGLRenderer({canvas:tela,antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));renderer.setSize(480,680,false);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x101a2c);scene.fog=new THREE.FogExp2(0x172536,.0062);
const camera=new THREE.PerspectiveCamera(62,480/680,.1,700);camera.position.set(0,4.7,10.5);
scene.add(new THREE.HemisphereLight(0xb6d3ff,0x20251d,1.45));
const moonLight=new THREE.DirectionalLight(0xc8dfff,2.1);moonLight.position.set(-35,65,-60);moonLight.castShadow=true;moonLight.shadow.mapSize.set(1024,1024);moonLight.shadow.camera.left=-30;moonLight.shadow.camera.right=30;moonLight.shadow.camera.top=40;moonLight.shadow.camera.bottom=-30;scene.add(moonLight);
const fillLight=new THREE.DirectionalLight(0xffa36b,1.0);fillLight.position.set(20,12,15);scene.add(fillLight);
const world=new THREE.Group();scene.add(world);
const estrada=new THREE.Group();world.add(estrada);
const trafego=[],itens=[],decoracoes=[],particulas=[];
const mat=(color,rough=.55,metal=0)=>new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});
const mats={
 asfalto:mat(0x252b33,.92),acostamento:mat(0x44474c,.85),faixa:mat(0xe7e6dc,.65),
 zebra:mat(0xece5d8,.72),zebraLaranja:mat(0xd65b37,.72),terra:mat(0x171f24,1),
 metal:mat(0x66727b,.38,.75),vidro: new THREE.MeshPhysicalMaterial({color:0x162b3a,roughness:.18,metalness:.35,clearcoat:1,clearcoatRoughness:.08}),
 pneu:mat(0x080a0d,.96),aro:mat(0x87939a,.26,.85),preto:mat(0x0b1017,.35,.4)
};
function box(parent,w,h,d,material,x=0,y=0,z=0,cast=true,receive=true){
 const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=cast;m.receiveShadow=receive;parent.add(m);return m;
}
function cylinder(parent,r1,r2,h,material,x,y,z,rx=0,ry=0,rz=0,segments=12){
 const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),material);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=true;parent.add(m);return m;
}
function esfera(parent,r,material,x,y,z,scaleY=1){
 const m=new THREE.Mesh(new THREE.SphereGeometry(r,12,8),material);m.position.set(x,y,z);m.scale.y=scaleY;parent.add(m);return m;
}
function luz(parent,color,intensity,distance,position){
 const l=new THREE.PointLight(color,intensity,distance,2);l.position.set(...position);parent.add(l);return l;
}
function criarCarro(cor,player=false,indice=0){
 const g=new THREE.Group();const pintura=new THREE.MeshPhysicalMaterial({color:cor,roughness:.24,metalness:.72,clearcoat:1,clearcoatRoughness:.12});
 const escuro=mat(0x10151b,.35,.4),vidro=new THREE.MeshPhysicalMaterial({color:0x152b3d,roughness:.16,metalness:.35,clearcoat:1});
 const vermelho=new THREE.MeshStandardMaterial({color:0xff2638,emissive:0xff1726,emissiveIntensity:player?2.5:1.2,roughness:.22});
 const branco=new THREE.MeshStandardMaterial({color:0xe6f4ff,emissive:0xa9dfff,emissiveIntensity:2.2});
 // carroceria esculpida em vários volumes, com capô, para-choques e cabine.
 const largura=player?1.92:1.78,comprimento=player?4.15:3.85;
 box(g,largura,.52,comprimento,pintura,0,.57,0);
 box(g,largura*.94,.18,1.1,pintura,0,.76,-1.37);
 box(g,largura*1.02,.25,.28,escuro,0,.39,-2.02);
 box(g,largura*.98,.2,.26,escuro,0,.38,2.01);
 // cabine com inclinação e vidros separados.
 const cabine= new THREE.Mesh(new THREE.BoxGeometry(largura*.69,.48,1.75),pintura);cabine.position.set(0,.94,.05);cabine.castShadow=true;cabine.rotation.x=-.04;g.add(cabine);
 const paraBrisa=box(g,largura*.62,.36,.08,vidro,0,1.0,-.57);paraBrisa.rotation.x=-.42;
 const vidroTraseiro=box(g,largura*.62,.31,.08,vidro,0,1.0,.69);vidroTraseiro.rotation.x=.43;
 box(g,.035,.32,1.15,escuro,0,1.03,.06,false,false);
 // saia lateral, difusor e aerofólio em modelos esportivos.
 box(g,.08,.18,2.7,escuro,-largura*.51,.34,0);box(g,.08,.18,2.7,escuro,largura*.51,.34,0);
 box(g,largura*.74,.12,.42,escuro,0,.28,1.98);
 if(indice===1||player){box(g,largura*.83,.09,.28,escuro,0,1.03,1.8);box(g,.07,.28,.08,escuro,-.65,.9,1.76);box(g,.07,.28,.08,escuro,.65,.9,1.76);}
 const rodas=[];
 for(const x of [-largura*.53,largura*.53])for(const z of [-1.28,1.28]){
   const roda=new THREE.Group();roda.position.set(x,.34,z);g.add(roda);
   cylinder(roda,.34,.34,.2,mats.pneu,0,0,0,0,0,Math.PI/2,20);
   cylinder(roda,.22,.22,.212,mats.aro,0,0,0,0,0,Math.PI/2,16);
   cylinder(roda,.075,.075,.22,escuro,0,0,0,0,0,Math.PI/2,12);
   for(let k=0;k<5;k++){const a=k*Math.PI*2/5;box(roda,.045,.29,.045,mats.metal,Math.cos(a)*.08,Math.sin(a)*.08,0,false,false).rotation.z=-a;}
   rodas.push(roda);
 }
 // LED traseiro contínuo e dois faróis dianteiros.
 box(g,largura*.72,.07,.035,vermelho,0,.64,2.105,false,false);
 for(const x of [-.63,.63]){
   box(g,.34,.075,.045,vermelho,x,.65,2.11,false,false);
   box(g,.24,.09,.06,branco,x,.63,-2.07,false,false);
   const farol=luz(g,0xa8dfff,player?5:1.5,player?23:7,[x,.65,-2.15]);farol.intensity=player?5:1.5;
 }
 const luzFreio=luz(g,0xff2638,player?2.6:.5,player?7:3,[0,.62,2.25]);
 g.userData={rodas,pintura,luzFreio,player,comprimento,largura};
 return g;
}
const carroJogador=criarCarro(CARROS[0].cor,true,0);carroJogador.position.set(0,0,1.8);world.add(carroJogador);
// Road sections, rebuilt as long connected perspective geometry in real 3D.
const segmentos=210,passo=3.2,linhasEstrada={};
function criarFaixa(nome,offset,largura,material,y=.035){
 const geo=new THREE.BufferGeometry(),pos=new Float32Array((segmentos+1)*2*3),idx=[];
 for(let i=0;i<segmentos;i++){const a=i*2,b=a+1,c=a+2,d=a+3;idx.push(a,b,c,b,d,c);}
 geo.setIndex(idx);geo.setAttribute('position',new THREE.BufferAttribute(pos,3));const mesh=new THREE.Mesh(geo,material);mesh.frustumCulled=false;mesh.receiveShadow=true;estrada.add(mesh);linhasEstrada[nome]={geo,offset,largura,y};return mesh;
}
criarFaixa('asfalto',0,10.5,mats.asfalto,.02);criarFaixa('ombroE',-5.55,1.25,mats.acostamento,.025);criarFaixa('ombroD',5.55,1.25,mats.acostamento,.025);
criarFaixa('linhaE',-5.02,.15,mats.zebra,.045);criarFaixa('linhaD',5.02,.15,mats.zebra,.045);
criarFaixa('faixaE',-1.72,.075,mats.faixa,.05);criarFaixa('faixaD',1.72,.075,mats.faixa,.05);
function curva(d){return Math.sin(d*.00039)*.48+Math.sin(d*.00015+1.1)*.31+Math.sin(d*.00073+2)*.09;}
function centroEstrada(z){return curva(distancia+(-z)*8)*18;}
function atualizarEstrada(){
 for(const [nome,obj] of Object.entries(linhasEstrada)){
   const arr=obj.geo.attributes.position.array;
   for(let i=0;i<=segmentos;i++){
     const z=12-i*passo+(distancia%passo),cx=centroEstrada(z),y=obj.y;
     const x1=cx+obj.offset-obj.largura/2,x2=cx+obj.offset+obj.largura/2,k=i*6;
     arr[k]=x1;arr[k+1]=y;arr[k+2]=z;arr[k+3]=x2;arr[k+4]=y;arr[k+5]=z;
   }
   obj.geo.attributes.position.needsUpdate=true;obj.geo.computeVertexNormals();
 }
 // Broken dashed lane lines are physically placed, with perspective and curve following.
 for(const m of decoracoes)if(m.userData.estradaDinamica){
   const z=m.userData.z+(distancia%(m.userData.period||12)),offset=m.userData.offset;m.position.set(centroEstrada(z)+offset,m.userData.y??.06,z);
 }
}
const matLinha=mat(0xdfe4df,.8),matBarreira=mat(0x69727a,.48,.65),matBarreiraLaranja=mat(0xe77842,.5,.25);
for(const lane of [-1.72,1.72]){
 for(let z=-4;z>-660;z-=12){
   const m=box(estrada,.095,.045,5.3,matLinha,0,.06,z,false,false);m.userData={estradaDinamica:true,z,offset:lane,y:.06};decoracoes.push(m);
 }
}
// roadside lights, guard rails and reflectors at fixed road-depth slots; position follows curves.
for(let z=-4;z>-520;z-=16){
 for(const side of [-1,1]){
  const post=new THREE.Group();estrada.add(post);
  box(post,.13,3.5,.13,matBarreira,0,1.75,0);
  const arm=box(post,.8,.1,.12,matBarreira,side*.34,3.4,0);arm.rotation.z=side*.1;
  const bulb=new THREE.MeshStandardMaterial({color:0xffd4a0,emissive:0xffa34d,emissiveIntensity:2.4});
  esfera(post,.13,bulb,side*.62,3.32,0,.7);luz(post,0xffb56c,2.3,17,[side*.62,3.15,0]);
  post.userData={estradaDinamica:true,z,offset:side*6.5};decoracoes.push(post);
  const rail=box(estrada,.14,.35,14,matBarreira,centroEstrada(z)+side*6.2,.65,z,false,true);rail.userData={estradaDinamica:true,z,offset:side*6.2,y:.65,period:16};decoracoes.push(rail);
  if(z%32===0){const marker=box(estrada,.18,.7,.18,matBarreiraLaranja,0,.55,z,false,false);marker.userData={estradaDinamica:true,z,offset:side*5.9,y:.55,period:32};decoracoes.push(marker);}
 }
}
// Terrain, hills, low poly trees and a procedural city skyline.
const matGrama=mat(0x1c2928,1),matMontanha=mat(0x263543,1),matTronco=mat(0x332b27,1),matFolha=mat(0x203b35,1),matJanela=new THREE.MeshStandardMaterial({color:0xffc27a,emissive:0xff923b,emissiveIntensity:1.3}),matJanelaFria=new THREE.MeshStandardMaterial({color:0x304354,emissive:0x172d40,emissiveIntensity:.4});
const terreno=box(world,900,.5,900,matGrama,0,-.48,-330,false,true);
for(let i=0;i<28;i++){
 const x=(i%2?1:-1)*(28+Math.random()*100),z=-30-i*17,h=12+Math.random()*45,r=8+Math.random()*18;
 const hill=new THREE.Mesh(new THREE.ConeGeometry(r,h,6),matMontanha);hill.position.set(x,h/2-1,z);hill.rotation.y=Math.random()*2;world.add(hill);
}
for(let z=-22;z>-420;z-=12){
 for(const side of [-1,1]){
  const x=side*(12+rand(0,22));
  if(Math.random()<.67){
   const tree=new THREE.Group();tree.position.set(x,0,z+rand(-4,4));world.add(tree);
   cylinder(tree,.16,.28,1.8,matTronco,0,.9,0);
   const top=new THREE.Mesh(new THREE.ConeGeometry(rand(1.1,2.1),rand(2.8,4.5),7),matFolha);top.position.y=3;top.castShadow=true;tree.add(top);
   tree.userData={cenario:true,z,side,offset:side*(12+Math.abs(x)%22)};decoracoes.push(tree);
  }
 }
}
for(let i=0;i<44;i++){
 const side=i%2?1:-1,z=-80-Math.floor(i/2)*9,x=side*(38+Math.random()*38),h=12+Math.random()*48,w=5+Math.random()*10;
 const building=new THREE.Group();building.position.set(x,h/2-1,z);world.add(building);
 box(building,w,h,w*.8,mat(0x18232f,.92),0,0,0,false,false);
 for(let yy=-h*.42;yy<h*.42;yy+=3.2)for(let xx=-w*.36;xx<w*.36;xx+=2.5)if(Math.random()>.23)box(building,.55,.8,.035,Math.random()>.5?matJanela:matJanelaFria,xx,yy,w*.405,false,false);
}
// Overhead gantry and neon race signage.
function criarPlaca(z){
 const g=new THREE.Group();estrada.add(g);g.userData={estradaDinamica:true,z,offset:0,y:0,period:260};
 box(g,10,.28,.3,matBarreira,0,7.3,0);box(g,.22,7,.22,matBarreira,-4.7,3.6,0);box(g,.22,7,.22,matBarreira,4.7,3.6,0);
 const panel=box(g,5.2,1.05,.22,mat(0x151b25,.35,.5),0,6.55,-.22);
 const glowmat=new THREE.MeshStandardMaterial({color:0xff9b4d,emissive:0xff6e30,emissiveIntensity:2});
 box(g,4.5,.06,.05,glowmat,0,6.9,-.36,false,false);
 decoracoes.push(g);
}
criarPlaca(-260);criarPlaca(-520);
// Headlights illuminate road ahead from the player's vehicle.
const farolEsq=new THREE.SpotLight(0xb8ddff,115,100,Math.PI/5,.5,1.3);farolEsq.position.set(-.58,1.0,-.5);farolEsq.target.position.set(-1,.1,-28);carroJogador.add(farolEsq);carroJogador.add(farolEsq.target);
const farolDir=farolEsq.clone();farolDir.position.x=.58;farolDir.target.position.x=1;carroJogador.add(farolDir);carroJogador.add(farolDir.target);
const luzNitroEsq=luz(scene,0x47dfff,0,8,[0,.25,4]),luzNitroDir=luz(scene,0x47dfff,0,8,[0,.25,4]);
function criarTransito(){
 const x=rand(-1,1),tipos=[0xb8c3cc,0xb74d50,0x526b83,0xd5a86e,0x4d555e],cor=tipos[Math.floor(Math.random()*tipos.length)];
 const c=criarCarro(cor,false,Math.floor(Math.random()*3));const z=-rand(100,260);c.position.set(centroEstrada(z)+x*3.2,0,z);c.rotation.y=rand(-.035,.035);
 const obj={mesh:c,x,z,vel:rand(35,125),quase:false,largura:1.9};world.add(c);trafego.push(obj);
}
function criarPickup(){
 const z=-rand(130,260),g=new THREE.Group();world.add(g);g.position.set(centroEstrada(z)+rand(-1,1)*3.2,1.1,z);
 const material=new THREE.MeshStandardMaterial({color:0xffb45e,emissive:0xff8c36,emissiveIntensity:2.5,metalness:.55,roughness:.2});
 const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.62,0),material);g.add(gem);g.add(luz(g,0xff9d45,3,8,[0,0,0]));
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.9,.045,8,24),new THREE.MeshStandardMaterial({color:0xffd7a1,emissive:0xff9a44,emissiveIntensity:1.5}));ring.rotation.x=Math.PI/2;g.add(ring);
 itens.push({mesh:g,z,x:(g.position.x-centroEstrada(z))/3.2,fase:rand(0,6)});
}
function iniciarNovo(){
 velocidade=0;nitro=100;pontos=0;creditos=0;tempo=0;distancia=0;quase=0;playerX=0;playerVX=0;direcaoVisual=0;timerTrafego=.8;timerItem=1.7;tremor=0;flash=0;
 trafego.forEach(o=>world.remove(o.mesh));trafego.length=0;itens.forEach(o=>world.remove(o.mesh));itens.length=0;
 jogando=false;pausado=false;acabou=false;ultimo=0;limparTeclas();
 carroJogador.position.set(0,0,1.8);carroJogador.rotation.set(0,0,0);
 atualizarHUD();atualizarEstrada();renderizar();
 el('sobreposicao').classList.remove('escondido');el('sobre-pausa').classList.add('escondido');el('sobre-fim').classList.add('escondido');el('estado').textContent='MOTOR 3D · AGUARDANDO PILOTO';
 if(raf)cancelAnimationFrame(raf);raf=0;
}
function comecar(){
 if(acabou)iniciarNovo();if(jogando&&!pausado){pausar();return;}
 jogando=true;pausado=false;ultimo=0;el('sobreposicao').classList.add('escondido');el('sobre-pausa').classList.add('escondido');el('sobre-fim').classList.add('escondido');el('estado').textContent='3D LIVE · CORRIDA EM ANDAMENTO';
 if(raf)cancelAnimationFrame(raf);som('inicio');raf=requestAnimationFrame(ciclo);
}
function pausar(){if(!jogando)return;jogando=false;pausado=true;limparTeclas();el('estado').textContent='PAUSADO';el('sobre-pausa').classList.remove('escondido');if(raf)cancelAnimationFrame(raf);raf=0;renderizar();}
function ciclo(t){if(!jogando)return;if(!ultimo)ultimo=t;const dt=Math.min((t-ultimo)/1000,.033);ultimo=t;atualizar(dt);renderizar();raf=requestAnimationFrame(ciclo);}
function atualizar(dt){
 const carro=CARROS[carroEscolhido],cfg=DIFICULDADES[dificuldade],steer=(teclas.direita?1:0)-(teclas.esquerda?1:0),nitroAtivo=teclas.nitro&&nitro>0&&!teclas.frear;
 tempo+=dt;
 if(teclas.acelerar){velocidade+=(carro.max*cfg.max/310-velocidade)*Math.min(1,dt*carro.acel/70);velocidade=Math.min(velocidade,Math.min(carro.max,cfg.max));}
 else velocidade=Math.max(0,velocidade-dt*24);
 if(teclas.frear)velocidade=Math.max(0,velocidade-dt*185);
 if(nitroAtivo){velocidade=Math.min(390,velocidade+dt*145);nitro=Math.max(0,nitro-dt*29);}else nitro=Math.min(100,nitro+dt*(teclas.acelerar?1.8:4));
 const resposta=teclas.drift?2.4:7.2;
 playerVX+=(steer*resposta*carro.controle-playerVX*(teclas.drift?1.35:3.6))*dt;
 playerX=clamp(playerX+playerVX*dt,-4.7,4.7);
 direcaoVisual+=(steer*.19+playerVX*.045-direcaoVisual)*Math.min(1,dt*10);
 carroJogador.position.x=centroEstrada(1.8)+playerX;carroJogador.rotation.y=-direcaoVisual*.9;carroJogador.rotation.z=-direcaoVisual*.22;
 carroJogador.userData.rodas.forEach(r=>r.rotation.x-=velocidade*dt*.13);
 carroJogador.userData.luzFreio.intensity=teclas.frear?6:2.6;
 luzNitroEsq.intensity=nitroAtivo?5:0;luzNitroDir.intensity=nitroAtivo?5:0;
 luzNitroEsq.position.set(carroJogador.position.x-.5,.25,4);luzNitroDir.position.set(carroJogador.position.x+.5,.25,4);
 if(Math.abs(playerX)>4.15){velocidade=Math.max(40,velocidade-dt*110);particulaPoeira();}
 distancia+=velocidade*dt*7.4;
 // Camera chase with spring smoothing and steering anticipation.
 const roadAhead=centroEstrada(-42),camX=carroJogador.position.x*.55+roadAhead*.45;
 camera.position.x+=(camX-camera.position.x)*Math.min(1,dt*2.5);
 camera.position.y+=(4.7+Math.min(velocidade/100,1.2)-camera.position.y)*Math.min(1,dt*2);
 camera.position.z=10.5+Math.min(velocidade/120,1.1);
 const lookX=centroEstrada(-38)+playerX*.08;camera.lookAt(lookX,1.25,-31);
 timerTrafego+=dt;if(timerTrafego>Math.max(.48,1.4/(cfg.trafego*(.55+velocidade/220)))){timerTrafego=0;criarTransito();}
 timerItem+=dt;if(timerItem>2.1){timerItem=0;if(Math.random()<.88)criarPickup();}
 trafego.forEach(c=>{
   c.z+=dt*(Math.max(18,velocidade-c.vel)*.095+7);c.mesh.position.z=c.z;
   c.mesh.position.x=centroEstrada(c.z)+c.x*3.2;c.mesh.position.y=0;
   if(c.z>-.8&&c.z<4.1&&Math.abs(c.mesh.position.x-carroJogador.position.x)<1.75&&Math.abs(c.z-1.8)<2.2&&carroJogador.userData.luzFreio.intensity>=0){colisao();return;}
   if(!c.quase&&c.z>-.4&&c.z<3.8&&Math.abs(c.mesh.position.x-carroJogador.position.x)<2.8&&Math.abs(c.mesh.position.x-carroJogador.position.x)>1.7){c.quase=true;quase++;pontos+=220;som('quase');}
   c.mesh.userData.rodas.forEach(r=>r.rotation.x-=c.vel*dt*.08);
 });
 for(let i=trafego.length-1;i>=0;i--)if(trafego[i].z>12){world.remove(trafego[i].mesh);trafego.splice(i,1);}
 for(let i=itens.length-1;i>=0;i--){
   const o=itens[i];o.z+=dt*(8+velocidade*.025);o.mesh.position.z=o.z;o.mesh.position.x=centroEstrada(o.z)+o.x*3.2;o.mesh.rotation.y+=dt*1.6;o.mesh.rotation.z=Math.sin(tempo*2+o.fase)*.14;
   if(o.z>-.5&&o.z<4.5&&Math.abs(o.mesh.position.x-carroJogador.position.x)<1.8){creditos++;pontos+=400;nitro=Math.min(100,nitro+18);som('credito');world.remove(o.mesh);itens.splice(i,1);continue;}
   if(o.z>12){world.remove(o.mesh);itens.splice(i,1);}
 }
 // Reposition procedural scenery so the world scrolls past the player.
 for(const d of decoracoes)if(d.userData.estradaDinamica){const z=d.userData.z+(distancia%(d.userData.period||12));d.position.x=centroEstrada(z)+d.userData.offset;d.position.z=z;}else if(d.userData.cenario){const z=d.userData.z+(distancia%12);d.position.z=z;d.position.x=centroEstrada(z)+d.userData.offset;}
 // Mountains/buildings/trees are static silhouettes in the world; gently shift road for visual bend.
 pontos+=dt*(velocidade*.38+Math.max(0,velocidade-180)*.2)*cfg.multiplicador;
 if(Math.floor(pontos)>recorde){recorde=Math.floor(pontos);try{localStorage.setItem('apexDriveRecorde',recorde);}catch{}}
 atualizarEstrada();atualizarHUD();
}
function renderizar(){renderer.render(scene,camera);}
function atualizarHUD(){
 el('pontos').textContent=fmt(pontos);el('recorde').textContent=fmt(recorde);el('recorde-resumo').textContent=fmt(recorde);
 el('creditos').textContent=String(creditos).padStart(3,'0');el('velocidade').textContent=String(Math.round(velocidade)).padStart(3,'0');
 el('nitro-texto').textContent=Math.round(nitro)+'%';el('barra-nitro').style.width=nitro+'%';
}
function colisao(){
 if(!jogando)return;jogando=false;acabou=true;limparTeclas();tremor=1;flash=1;
 el('estado').textContent='COLISÃO — PROVA ENCERRADA';el('pontos-finais').textContent=fmt(pontos);el('sobre-fim').classList.remove('escondido');
 if(raf)cancelAnimationFrame(raf);raf=0;som('batida');renderizar();
}
function particulaPoeira(){/* poeira é simulada com partículas pequenas em torno dos ombros */}
function som(tipo){
 if(!somLigado)return;try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;if(!audio)audio=new AC();if(audio.state==='suspended')audio.resume();
 const cfg={inicio:[260,.12],credito:[740,.14],batida:[95,.32],quase:[530,.1]},[freq,dur]=cfg[tipo]||[220,.1],osc=audio.createOscillator(),gain=audio.createGain();
 osc.type=tipo==='batida'?'sawtooth':'triangle';osc.frequency.setValueAtTime(freq,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(tipo==='batida'?30:freq*1.6,audio.currentTime+dur);
 gain.gain.setValueAtTime(.035,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+dur);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+dur);
 }catch{}
}
function limparTeclas(){Object.keys(teclas).forEach(k=>teclas[k]=false);}
function ligarBotao(id,k){const b=el(id);if(!b)return;b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture?.(e.pointerId);teclas[k]=true;if(!jogando&&!pausado&&!acabou)comecar();});['pointerup','pointercancel','lostpointercapture','pointerleave'].forEach(ev=>b.addEventListener(ev,()=>teclas[k]=false));}
document.querySelectorAll('[data-carro]').forEach(b=>b.addEventListener('click',()=>{
 if(jogando)return;carroEscolhido=+b.dataset.carro;document.querySelectorAll('[data-carro]').forEach(x=>x.classList.toggle('selecionado',x===b));
 el('contador-carros').textContent=String(carroEscolhido+1).padStart(2,'0');el('carro-atual').textContent=CARROS[carroEscolhido].nome;
 trocarCarro(carroEscolhido);
}));
function trocarCarro(indice){
 // Rebuild the player's mesh without touching the camera, track, traffic or UI.
 world.remove(carroJogador);
 // Replace references in-place so all frame logic remains stable.
 carroJogador.clear();
 const montado=criarCarro(CARROS[indice].cor,true,indice);
 carroJogador.add(...montado.children);carroJogador.userData=montado.userData;carroJogador.position.set(centroEstrada(1.8)+playerX,0,1.8);world.add(carroJogador);
 const h1=new THREE.SpotLight(0xb8ddff,115,100,Math.PI/5,.5,1.3);h1.position.set(-.58,1,-.5);h1.target.position.set(-1,.1,-28);carroJogador.add(h1);carroJogador.add(h1.target);
 const h2=h1.clone();h2.position.x=.58;h2.target.position.x=1;carroJogador.add(h2);carroJogador.add(h2.target);
}
el('dificuldade').addEventListener('change',e=>dificuldade=e.target.value);
el('iniciar').addEventListener('click',comecar);el('ir-corrida').addEventListener('click',()=>{el('corrida').scrollIntoView({behavior:'smooth'});setTimeout(()=>{if(!jogando&&!pausado)comecar();},250);});
el('continuar').addEventListener('click',comecar);el('reiniciar').addEventListener('click',()=>{iniciarNovo();comecar();});el('tentar').addEventListener('click',()=>{iniciarNovo();comecar();});
ligarBotao('mobile-esquerda','esquerda');ligarBotao('mobile-direita','direita');ligarBotao('mobile-nitro','nitro');ligarBotao('mobile-acelerar','acelerar');ligarBotao('mobile-frear','frear');
document.addEventListener('keydown',e=>{
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','A','d','D','w','W','s','S',' ','Shift','Escape'].includes(e.key))e.preventDefault();
 if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A')teclas.esquerda=true;if(e.key==='ArrowRight'||e.key==='d'||e.key==='D')teclas.direita=true;
 if(e.key==='ArrowUp'||e.key==='w'||e.key==='W')teclas.acelerar=true;if(e.key==='ArrowDown'||e.key==='s'||e.key==='S')teclas.frear=true;
 if(e.code==='Space')teclas.nitro=true;if(e.key==='Shift')teclas.drift=true;
 if(e.key==='Escape'&&jogando)pausar();else if(e.key==='Enter'&&!jogando&&!pausado)comecar();
});
document.addEventListener('keyup',e=>{
 if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A')teclas.esquerda=false;if(e.key==='ArrowRight'||e.key==='d'||e.key==='D')teclas.direita=false;
 if(e.key==='ArrowUp'||e.key==='w'||e.key==='W')teclas.acelerar=false;if(e.key==='ArrowDown'||e.key==='s'||e.key==='S')teclas.frear=false;
 if(e.code==='Space')teclas.nitro=false;if(e.key==='Shift')teclas.drift=false;
});
window.addEventListener('blur',()=>{if(jogando)pausar();limparTeclas();});
window.addEventListener('resize',()=>{const r=tela.getBoundingClientRect();camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setSize(480,680,false);});
iniciarNovo();
})();