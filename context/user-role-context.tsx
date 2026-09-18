"use client";
import {advertisers} from "@/data/mock/repository";
import {createContext,useContext,useEffect,useState} from "react";
import type {SessionUser,UserRole} from "@/types/auth";
import {can,currentUser,mockUser,setMockRole,installSessionUser} from "@/lib/permissions";
const Context=createContext<{user:SessionUser;ready:boolean;qaSwitch:boolean;changeRole:(role:UserRole)=>void}>({user:mockUser("super_admin"),ready:false,qaSwitch:false,changeRole:()=>{}});
export function UserRoleProvider({children}:{children:React.ReactNode}){const [user,setUser]=useState(currentUser()),[ready,setReady]=useState(false),[qaSwitch,setQaSwitch]=useState(false);useEffect(()=>{const next=currentUser();setUser(next);setQaSwitch(process.env.NODE_ENV==="development"&&can(next.role,"MANAGE_SETTINGS"));setReady(true);},[]);return <Context.Provider value={{user,ready,qaSwitch,changeRole:role=>{if(!qaSwitch)return;setMockRole(role);const next={...currentUser(),role,advertiserId:advertisers[0]?.id??"",advertiserIds:advertisers.map(a=>a.id)};installSessionUser(next);setUser(next);}}}>{children}</Context.Provider>;}
export const useUserRole=()=>useContext(Context);
