import { Context, Schema, Random, Bot } from "koishi"

export const name = "group-roulette"

export interface Config {
    banDuration: number;
}

export const Config: Schema<Config> = Schema.object({
    banDuration: Schema.number()
        .step(1)
        .default(60)
        // 设置描述信息
        .description("设置禁言时长，单位为秒")
})

const hitNotice = ["随着一声巨响倒下了……", "面对着不可逆转的命运，选择了放弃……", "倒在了一片血泊之中……", "意外走火了", "的视线逐渐模糊……"];
const unhitNotice = ["躲过一劫", "扣下了扳机，什么事也没发生", "向死神借了一条命", "幸运的躲过一击"];


export function apply(ctx: Context, config: Config) {
    // write your plugin here
    ctx.command("roulette", "进行群聊轮盘游戏")
        .alias("轮盘")
        .usage("开一轮紧张刺激的轮盘游戏\n提示：禁止将本插件做赌博之用，出现任何问题本人概不负责")
        .option("quantity", "-q [value:posint] 子弹总数，默认为5", { fallback: 5 })
        .option("liveA", "-l [value:posint] 指定实弹数量。默认为随机")
        .option("disableBan", "-d 禁用禁言惩罚")
        .option("allowRepeat", "-a 允许单人多次开枪")
        .action(({ options, session }) => {

            if (session.isDirect === true) {
                return "请在群聊运行此命令"
            } else if (options.quantity > 20) {
                return "总子弹数不能超过二十个"
            } else if ("liveA" in options && options.liveA > options.quantity) {
                return "实弹数量不能大于总子弹数"
            } else if ("liveA" in options && options.liveA < 1) {
                return "实弹数量不能小于 1"
            }

            let players = {};
            let bullets = [];
            let position = 0;
            let liveACount = "liveA" in options ? options.liveA : Random.int(1, options.quantity - 1);
            
            //生成随机“子弹”
            for (let i = 0; i < options.quantity; i++) {
                if (i <= liveACount - 1) {
                    bullets.push(true);
                } else {
                    bullets.push(false);
                }
            }
            //打乱
            bullets = Random.shuffle(bullets);

            session.send("群轮盘游戏开始！\n发送“开枪”即可参与游戏，发送“收手”或两分钟之内无回复自动结束");

            let messageEvent = ctx.middleware((session,next) => {
                
                
                let user = session.event.user;
                let guild = session.event.guild

                if (session.content === "开枪") {

                    timer()
                    timer = ctx.setTimeout(() => {
                        messageEvent();
                        session.send("已超时，游戏结束");
                    }, 120000)

                    if (!("allowRepeat" in options) && (user.id in players)) {
                        session.sendQueued("你已经开过枪了");

                    } else {
                        players[user.id] = bullets[position];

                        //抽中实弹
                        if (bullets[position]) {
                            if (!("disableBan" in options)) {
                                session.bot.muteGuildMember(guild.id, user.id, config.banDuration * 1000)
                                session.sendQueued(`${user.name}已被禁言 ${config.banDuration} 秒`)
                            }

                            session.sendQueued(`${user.name}${hitNotice[Random.int(0, hitNotice.length - 1)]}\n\n第 ${position + 1} 颗是实弹\n还有 ${options.quantity - (position + 1)} 颗子弹\n发送“开枪”继续`)
                        } else {//空包弹
                            session.sendQueued(`${user.name}${unhitNotice[Random.int(0, unhitNotice.length - 1)]}\n\n第 ${position + 1} 颗是空包弹\n还有 ${options.quantity - (position + 1)} 颗子弹\n发送“开枪”继续`)
                        }

                        position++;

                        if (position >= options.quantity) {
                            //position = 0;
                            let t = ""
                            for (let u = 0; u < bullets.length; u++) {
                                t += bullets[u] ? "●" : "○";
                            }

                            session.sendQueued(`游戏结束\n共 ${options.quantity} 颗子弹，${liveACount} 颗实弹\n${t}\n\n发送“轮盘”可再开一局 (OωO)`)
                            
                            //完成后销毁掉中间件和timer
                            timer();
                            messageEvent()
                            return next();

                        }

                    }

                } else if (session.content === "收手") {
                    
                    session.send("游戏结束");
                    
                    timer();
                    messageEvent();
                    return next();
                }
            })

            let timer = ctx.setTimeout(() => {
                messageEvent();
                session.send("已超时，游戏结束");
            }, 120000)

        })

}
