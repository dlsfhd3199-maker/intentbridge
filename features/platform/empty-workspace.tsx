"use client";
import {useDashboard} from '@/components/app-shell';
import {useGA4} from '@/features/ga4/provider';
import {WorkspacePlatform} from './workspace-platform';
export function EmptyWorkspace({children}:{children:React.ReactNode}){const d=useDashboard(),{mode}=useGA4();return mode!=='real'&&d.source.uniqueUsers===0?<WorkspacePlatform/>:<>{children}</>;}
