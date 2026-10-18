import React,{useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,Image,ScrollView,StyleSheet,Switch,Text,TextInput,TouchableOpacity,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {useRouter} from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {api,getApiErrorMessage} from "../src/api";
import {useAuth} from "../src/auth";
import {LineItemEditor,type LineItem} from "../src/components/LineItemEditor";
type Input={title:string;client_name:string;address:string;description:string;dimensions:string;photos:string[]};
type Variant={nazev:string;uroven:string;popis:string;postup:string[];orientacni_cena:string};
type Plan={prace:LineItem[];material:LineItem[];doprava:LineItem[];poznamky:string;platce_dph?:boolean};
type Draft=Input&{id:string;analysis?:{obor:string;rozpoznano:string;varianty:Variant[]};selected?:number;plan?:Plan;edit_visual?:string;schema_visual?:string;job_id?:string};
const empty:Input={title:"",client_name:"",address:"",description:"",dimensions:"",photos:[]};
function withIds(plan:Plan):Plan{return {...plan,...Object.fromEntries((["prace","material","doprava"] as const).map(key=>[key,plan[key].map((r,i)=>({...r,id:key+"-"+i}))]))};}
function clean(plan:Plan){const rows=(items:LineItem[])=>items.map(({popis,jednotka,mnozstvi,cena})=>({popis,jednotka,mnozstvi,cena}));return {prace:rows(plan.prace),material:rows(plan.material),doprava:rows(plan.doprava),poznamky:plan.poznamky,platce_dph:plan.platce_dph===true};}
export default function Workflow(){
 const router=useRouter();const {user,loading}=useAuth();const [input,setInput]=useState<Input>({...empty});const [draft,setDraft]=useState<Draft|null>(null);const [list,setList]=useState<{id:string;title:string;client_name:string;job_id?:string}[]>([]);const [plan,setPlan]=useState<Plan|null>(null);const [full,setFull]=useState(false);const [busy,setBusy]=useState("");const [step,setStep]=useState(0);const gate=useRef(false);
 useEffect(()=>{if(!loading&&!user)router.replace("/login");},[loading,user,router]);
 const refresh=useCallback(async()=>{const [a,d]=await Promise.all([api.get("/jarvis/access"),api.get("/jarvis/drafts")]);setFull(a.data.full===true);setList(d.data);},[]);
 useEffect(()=>{if(user)void refresh().catch(e=>Alert.alert("JARVIS",getApiErrorMessage(e)));},[user,refresh]);
 async function run(label:string,fn:()=>Promise<void>){if(gate.current)return;gate.current=true;setBusy(label);try{await fn();}catch(e){Alert.alert("JARVIS",getApiErrorMessage(e));}finally{gate.current=false;setBusy("");}}
 function restore(d:Draft){setDraft(d);setInput(d);setPlan(d.plan?withIds(d.plan):null);setStep(d.job_id?4:d.plan?3:d.selected!==undefined?2:d.analysis?1:0);}
 async function pick(camera:boolean){await run("Načítám fotografie",async()=>{
  const permission=camera?await ImagePicker.requestCameraPermissionsAsync():await ImagePicker.requestMediaLibraryPermissionsAsync();if(!permission.granted){Alert.alert("Fotografie","Povolte přístup k fotoaparátu nebo galerii.");return;}
  const options:ImagePicker.ImagePickerOptions={mediaTypes:["images"],base64:true,quality:0.25,allowsMultipleSelection:!camera,selectionLimit:5-input.photos.length};
  const result=camera?await ImagePicker.launchCameraAsync(options):await ImagePicker.launchImageLibraryAsync(options);if(result.canceled)return;
  const images=result.assets.map(a=>a.base64?"data:image/jpeg;base64,"+a.base64:"");if(images.some(p=>!p||p.length>1_500_000)){Alert.alert("Velikost fotografie","Použijte menší fotografie, nejvýše 1 MB na snímek.");return;}
  setInput(v=>({...v,photos:[...v.photos,...images].slice(0,5)}));
 });}
 async function analyze(){await run("Analyzuji zadání",async()=>{
  if(!full){router.push("/jarvis-aktivace");return;}
  // Save before any AI call. A provider failure can be resumed from the account.
  const payload={title:input.title,client_name:input.client_name,address:input.address,description:input.description,dimensions:input.dimensions,photos:input.photos};
  const d=(draft?(await api.put(`/jarvis/drafts/${draft.id}`,payload)):(await api.post("/jarvis/drafts",payload))).data as Draft;setDraft(d);
  const result=await api.post(`/jarvis/drafts/${d.id}/analyze`,{}, {timeout:100000});setDraft({...d,analysis:result.data,selected:undefined,plan:undefined});setStep(1);await refresh();
 });}
 async function select(index:number){await run("Ukládám řešení",async()=>{if(!draft)return;await api.post(`/jarvis/drafts/${draft.id}/select`,{index});setDraft({...draft,selected:index,plan:undefined,edit_visual:undefined,schema_visual:undefined});setPlan(null);setStep(2);});}
 async function visual(mode:"edit"|"schema"){await run("Generuji vizualizaci",async()=>{if(!draft)return;const r=await api.post(`/jarvis/drafts/${draft.id}/visual`,{mode},{timeout:100000});setDraft({...draft,[mode+"_visual"]:r.data.imageUrl});});}
 async function build(){await run("Sestavuji rozpočet",async()=>{if(!draft)return;const r=await api.post(`/jarvis/drafts/${draft.id}/plan`,{},{timeout:100000});setPlan(withIds(r.data));setDraft({...draft,plan:r.data});setStep(3);});}
 async function commit(){await run("Ukládám zakázku",async()=>{if(!draft||!plan)return;await api.put(`/jarvis/drafts/${draft.id}/plan`,clean(plan));const r=await api.post(`/jarvis/drafts/${draft.id}/commit`,{});setDraft({...draft,job_id:r.data.job_id});setStep(4);await refresh();});}
 const total=plan?([...plan.prace,...plan.material,...plan.doprava].reduce((s,r)=>s+r.mnozstvi*r.cena,0)):0;
 const button=(title:string,onPress:()=>void,disabled=false)=><TouchableOpacity accessibilityRole="button" disabled={!!busy||disabled} onPress={onPress} style={[s.button,(!!busy||disabled)&&{opacity:0.45}]}><Text style={s.buttonText}>{title}</Text></TouchableOpacity>;
 const field=(key:keyof Omit<Input,"photos">,label:string,multiline=false)=><View style={s.card}><Text style={s.label}>{label}</Text><TextInput value={input[key]} onChangeText={v=>setInput({...input,[key]:v})} multiline={multiline} editable={full&&!busy} style={[s.input,multiline&&{minHeight:100}]} maxLength={key==="description"?10000:2000}/></View>;
 return <SafeAreaView style={s.page}><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"><TouchableOpacity onPress={()=>router.back()}><Text style={s.back}>‹ Zpět do Řemeslníka Pro</Text></TouchableOpacity><Text style={s.title}>JARVIS</Text><Text style={s.sub}>{full?"Plný průvodce zakázkou":"Náhled uložených návrhů · Omezený režim"}</Text><View style={s.steps}>{["Zadání","Řešení","Vizualizace","Rozpočet","Zakázka"].map((label,i)=><Text key={label} style={[s.step,step===i&&s.current]}>{i+1}. {label}</Text>)}</View>
 {busy?<View style={s.card}><ActivityIndicator/><Text style={s.label}>{busy}…</Text></View>:null}
 {step===0?<>
 {!draft&&list.length>0?<View style={s.card}><Text style={s.label}>Pokračovat v návrhu</Text>{list.map(d=><TouchableOpacity disabled={!!busy} key={d.id} onPress={()=>void run("Načítám návrh",async()=>restore((await api.get(`/jarvis/drafts/${d.id}`)).data))}><Text style={s.back}>{d.title} · {d.client_name}{d.job_id?" ✓":""}</Text></TouchableOpacity>)}</View>:null}
 {field("title","Název zakázky")}{field("client_name","Klient")}{field("address","Adresa")}{field("description","Popis závady nebo požadavku · lze diktovat mikrofonem klávesnice",true)}{field("dimensions","Naměřené rozměry a jednotky",true)}
 <Text style={s.label}>Fotografie: {input.photos.length}/5 · nejméně 3</Text><Text style={s.note}>Celek, detail závady a širší souvislosti. Fotografie nenahrazují popis ani měření.</Text><View style={s.photos}>{input.photos.map((p,i)=><TouchableOpacity key={i} disabled={!full||!!busy} onPress={()=>setInput({...input,photos:input.photos.filter((_,n)=>n!==i)})}><Image source={{uri:p}} style={{width:95,height:95,borderRadius:8}}/><Text> {"Odebrat"}</Text></TouchableOpacity>)}</View>
 {full&&input.photos.length<5?<>{button("Vyfotit",()=>void pick(true))}{button("Vybrat fotografie",()=>void pick(false))}</>:null}
 {button(draft?"Zopakovat analýzu uloženého zadání":"Uložit zadání a navrhnout řešení",()=>void analyze(),!full||input.photos.length<3||input.description.trim().length<10||!input.title.trim()||!input.client_name.trim())}
 </>:null}
 {step===1&&draft?.analysis?<><View style={s.card}><Text style={s.label}>{draft.analysis.obor}</Text><Text>{draft.analysis.rozpoznano}</Text></View>{draft.analysis.varianty.map((v,i)=><View style={s.card} key={i}><Text style={s.label}>{v.nazev} · {v.uroven}</Text><Text>{v.popis}</Text><Text style={s.back}>{v.orientacni_cena}</Text>{v.postup.map((k,n)=><Text key={n}>{n+1}. {k}</Text>)}{button("Vybrat řešení",()=>void select(i),!full)}</View>)}</>:null}
 {step===2&&draft?<><Text style={s.label}>Vizualizace pro klienta</Text><Text style={s.note}>Ilustrační návrh výsledku a schéma. Technické provedení a rozměry kontroluje řemeslník.</Text><Image source={{uri:input.photos[0]}} style={s.visual}/><Text>Původní stav</Text>{draft.edit_visual?<Image source={{uri:draft.edit_visual}} style={s.visual}/>:null}{button("Vygenerovat stav po dokončení",()=>void visual("edit"),!full)}{draft.schema_visual?<Image source={{uri:draft.schema_visual}} style={s.visual}/>:null}{button("Vygenerovat schéma",()=>void visual("schema"),!full)}{button("Sestavit plán a rozpočet",()=>void build(),!full)}</>:null}
 {step===3&&plan?<><Text style={s.label}>Zkontrolujte a upravte položky</Text><Text style={s.note}>Orientační jednotkové ceny bez DPH. Zálohu a výslednou nabídku dokončíte v kartě zakázky.</Text>{(["prace","material","doprava"] as const).map(key=><View key={key} style={s.card}><Text style={s.label}>{{prace:"Práce",material:"Materiál",doprava:"Doprava"}[key]}</Text><LineItemEditor rows={plan[key]} onChange={rows=>setPlan({...plan,[key]:rows})} testIDPrefix={"jarvis-"+key}/></View>)}<View style={s.card}><Text style={s.label}>Plátce DPH · připočítat 21 %</Text><Switch value={plan.platce_dph===true} onValueChange={v=>setPlan({...plan,platce_dph:v})}/></View><TextInput value={plan.poznamky} onChangeText={v=>setPlan({...plan,poznamky:v})} multiline style={s.input}/><Text style={s.title}>{(total*(plan.platce_dph?1.21:1)).toLocaleString("cs-CZ",{maximumFractionDigits:2})} Kč {plan.platce_dph?"s DPH":""}</Text>{button("Uložit rozpracovaný rozpočet",()=>void run("Ukládám rozpočet",async()=>{if(draft)await api.put(`/jarvis/drafts/${draft.id}/plan`,clean(plan));}),!full)}{button("Potvrdit vytvoření zakázky",()=>Alert.alert("Vytvořit zakázku?","Uloží se zkontrolované položky. PDF nabídku připravíte v kartě zakázky.",[{text:"Zrušit",style:"cancel"},{text:"Vytvořit",onPress:()=>void commit()}]),!full)}</>:null}
 {step===4&&draft?.job_id?<View style={s.card}><Text style={s.label}>Zakázka je uložená v Řemeslníku Pro</Text><Text>V kartě zakázky upravíte nabídku a zálohu a stáhnete PDF.</Text>{button("Otevřít zakázku a PDF nabídku",()=>router.push(("/zakazka/"+draft.job_id) as never))}</View>:null}
 {step>0&&step<4?button("Předchozí krok",()=>setStep(step-1)):null}
 {draft?button("Nové zadání",()=>{setDraft(null);setPlan(null);setInput({...empty});setStep(0);}):null}
 {!full?button("Aktivovat plnou nadstavbu",()=>router.push("/jarvis-aktivace")):null}
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:"#f4f1eb"},content:{padding:20,paddingBottom:70,gap:14},title:{fontSize:28,fontWeight:"800",color:"#182333"},sub:{fontSize:16,color:"#1264a3"},back:{color:"#1264a3",fontSize:16,paddingVertical:8},steps:{flexDirection:"row",flexWrap:"wrap",gap:8},step:{padding:7,color:"#627184",fontSize:12},current:{backgroundColor:"#1264a3",color:"white",borderRadius:8},card:{padding:16,gap:12,backgroundColor:"white",borderRadius:12},label:{fontWeight:"700",fontSize:16,color:"#182333"},input:{backgroundColor:"white",padding:14,borderWidth:1,borderColor:"#c6cdd6",borderRadius:10,fontSize:16,textAlignVertical:"top"},button:{backgroundColor:"#1264a3",padding:16,borderRadius:10},buttonText:{color:"white",textAlign:"center",fontWeight:"700",fontSize:16},note:{color:"#627184",lineHeight:21},photos:{flexDirection:"row",flexWrap:"wrap",gap:8},visual:{width:"100%",height:280,borderRadius:12,resizeMode:"contain",backgroundColor:"white"}});
