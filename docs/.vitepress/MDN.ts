import {type DefaultTheme } from "vitepress";

export function sidebarMDN():DefaultTheme.SidebarItem[]
{
    return [
        {
            text:"MDN",
            items:[
                {text:"INDEX",link:"index"},
            ]
        }
    ]
}

export function glossary()
{
    return "";
}
