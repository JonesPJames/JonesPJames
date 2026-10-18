import React, { useCallback, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api, getApiErrorMessage } from "../api";
export function JarvisAccess() {
  const router=useRouter();
  const [state,setState]=useState<{full:boolean;expires_at?:number}|null>(null);
  const [error,setError]=useState("");
  useFocusEffect(useCallback(()=>{let active=true;void api.get("/jarvis/access").then(r=>{if(active){setState(r.data);setError("");}}).catch(e=>{if(active)setError(getApiErrorMessage(e));});return()=>{active=false;};},[]));
  return <View style={{backgroundColor:"#fff",padding:18,borderRadius:12,gap:12}}>
    <Text style={{fontWeight:"800",fontSize:18,color:"#182333"}}>{state?.full?"JARVIS · Plný režim":"JARVIS · Omezený režim"}</Text>
    {!state&&!error?<ActivityIndicator/>:null}
    <Text style={{color:"#526176",lineHeight:21}}>{state?.full?"Návrhy řešení, vizualizace a rozpočet přímo do vašich zakázek.":"Základní asistent zůstává dostupný. Plná nadstavba přidává návrhy řešení z fotografií, vizualizace a položkový rozpočet."}</Text>
    {error?<Text style={{color:"#9c2525"}}>Stav přístupu se nepodařilo ověřit. {error}</Text>:null}
    <TouchableOpacity disabled={!state} onPress={()=>router.push(state?.full?"/jarvis-pruvodce":"/jarvis-aktivace")} style={{padding:14,backgroundColor:"#1264a3",borderRadius:10,opacity:state?1:0.5}}><Text style={{color:"white",fontWeight:"700",textAlign:"center"}}>{state?.full?"Otevřít plného JARVISe":"Plná nadstavba a aktivace"}</Text></TouchableOpacity>
    <TouchableOpacity onPress={()=>router.push("/jarvis-aktivace")}><Text style={{color:"#1264a3"}}>Předplatné a aktivace</Text></TouchableOpacity>
    <TouchableOpacity onPress={()=>router.push("/jarvis-pruvodce")}><Text style={{color:"#1264a3"}}>Moje rozpracované návrhy</Text></TouchableOpacity>
  </View>;
}
