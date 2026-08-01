---
title: "IQPIR：当 Ground Truth 也不再值得完全相信"
date: 2026-08-01T00:00:00+08:00
lastmod: 2026-08-01T00:00:00+08:00
draft: false
description: "理解 Beyond Ground-Truth: Leveraging Image Quality Priors for Real-World Image Restoration 的双码本、质量条件 Transformer 与离散质量优化。"
summary: "IQPIR 的核心不是重新设计一个更大的恢复网络，而是承认真实数据集的 GT 质量参差不齐，并把无参考 IQA 变成质量先验、条件信号和训练目标。"
categories: ["Image Restoration"]
tags: ["Image Restoration", "Codebook", "IQA", "Real-World Restoration", "论文阅读"]
keywords: ["IQPIR", "Image Quality Prior", "Dual Codebook", "NR-IQA", "Quality-conditioned Transformer"]
paper_url: "https://openaccess.thecvf.com/content/CVPR2026/html/Xiao_Beyond_Ground-Truth_Leveraging_Image_Quality_Priors_for_Real-World_Image_Restoration_CVPR_2026_paper.html"
venue: "CVPR 2026"
weight: 1
---

{{< katex >}}

> **论文**：*Beyond Ground-Truth: Leveraging Image Quality Priors for Real-World Image Restoration*，CVPR 2026。  
> **一句话概括**：IQPIR 不再默认数据集中的 GT 都是完美答案，而是用多个无参考 IQA 模型提取图像质量先验，再结合通用码本和高质量专属码本，引导修复结果向更好的感知质量靠近。

## 这篇论文为什么要怀疑 GT

监督学习通常把 GT 当作绝对正确的目标：

$$
\mathcal L_{rec}=\|X_{res}-X_h\|.
$$

但真实数据集里的所谓高清参考图，可能仍然带有噪声、模糊、曝光问题或运动残影。模型如果始终拟合这些 GT，最终学到的往往是训练集的平均画质，而不是人眼能够接受的最高画质。

论文用 LOL-v1、LOL-v2-real 和 FFHQ 的 GT 做 IQA 分数统计。LOL-v2-real 的分布尤其说明问题：一部分图像集中在非常低的质量区间，另一部分落在中等质量区间。不同 IQA 模型给出的分数还不完全一致，这说明单个 IQA 模型存在偏见，也解释了作者为什么采用多个 NR-IQA 模型集成。

这篇工作的真正问题定义是：

> 如果监督本身有高低之分，为什么所有 GT 都应该以同样的方式训练模型？

## 整体框架：两个阶段

IQPIR 包含两个相互独立但前后衔接的阶段：

1. Stage I：预训练双码本，建立通用结构库和高质量细节库；
2. Stage II：训练质量条件 Transformer，从低质量输入预测目标质量对应的离散特征。

你提到的 (X_{rec}) 和 (X_{res}) 并不是同时作为一个损失一起反向传播。它们属于两个阶段：(X_{rec}) 用于第一阶段码本预训练，(X_{res}) 用于第二阶段正式图像修复。通常第一阶段完成后，码本和 HQ Decoder 会冻结，第二阶段主要更新 LQ Encoder 与质量条件 Transformer。

## Stage I：双码本学习

给定高清真值图 (X_h)，HQ Encoder 提取隐特征：

$$
Z_h=E_h(X_h).
$$

### Common codebook

所有 GT 都可以更新 Common codebook。它学习的是不同图像共有的结构信息：

- 轮廓；
- 物体布局；
- 基础颜色和形状；
- 不依赖画质高低的通用语义。

经过向量量化后得到：

$$
Z_q^1=Q_{common}(Z_h).
$$

### HQ+ codebook

与此同时，(X_h) 送入多个 NR-IQA 模型，得到综合质量分数：

$$
S=\frac{1}{K}\sum_{k=1}^{K}s_k(X_h).
$$

如果：

$$
S>S_{Thr},
$$

则认为该样本足够高质量，允许它更新 HQ+ codebook；否则只参与 Common codebook，不允许污染高清细节库。

HQ+ codebook 学习发丝、边缘、纹理等对感知质量敏感的高频信息：

$$
Z_q^2=Q_{HQ+}(Z_h).
$$

两套量化特征融合后送入 HQ Decoder：

$$
X_{rec}=D_h(Z_q^1+Z_q^2).
$$

第一阶段通过重构损失训练编码器、解码器和码本：

$$
\mathcal L_{stage1}=\|X_{rec}-X_h\|_1+\mathcal L_{vq}.
$$

这里的关键不是“有两个码本”这么简单，而是 **IQA 分数控制 HQ+ 码本的更新开关**。低质量 GT 仍然有价值，因为它可以帮助学习通用结构；但它不应该参与高质量细节知识库的构建。

## Stage II：质量条件 Transformer

低质量图像 (X_l) 经过 LQ Encoder：

$$
Z_l=E_l(X_l).
$$

Transformer 接收两类输入：低质量特征 (Z_l) 和质量条件 (S)。训练时使用 GT 对应的真实质量分数；推理时可以把 (S) 设为较高的目标质量，引导模型向感知质量更好的方向输出。

可以把它看成一个条件映射：

$$
(Z_l,S)\longrightarrow (Z_f^1,Z_f^2).
$$

其中 (Z_f^1) 查询冻结的 Common codebook，(Z_f^2) 查询冻结的 HQ+ codebook。两者融合后经 HQ Decoder 得到修复结果：

$$
X_{res}=D_h(Z_f^1+Z_f^2).
$$

当输入的目标质量分数较高时，Transformer 会更倾向于调用 HQ+ 码本中的细节；当质量条件较低时，模型则更保守地依赖通用结构。它因此获得了一定的感知质量控制能力。

## 三种损失如何共同训练

第二阶段的损失可以拆成三部分。

### 特征对齐损失

约束低质量输入预测出的特征不要偏离高清目标：

$$
\mathcal L_{feat}=\|Z_f-Z_q\|_1.
$$

它主要负责结构和内容保真。

### 码索引损失

Transformer 需要预测两个码本中的离散索引，因此可以使用交叉熵约束索引选择：

$$
\mathcal L_{index}=\operatorname{CE}(\hat k^1,k^1)+\operatorname{CE}(\hat k^2,k^2).
$$

### 质量损失

把修复结果送入多个 NR-IQA 模型，最大化综合质量分数：

$$
\mathcal L_{quality}=-S(X_{res}).
$$

最终目标可以写成：

$$
\mathcal L_{stage2}=\mathcal L_{feat}+\lambda_1\mathcal L_{index}+\lambda_2\mathcal L_{quality}.
$$

因此，你的理解基本正确，但要区分两件事：(X_{rec}) 是第一阶段的码本重构结果，(X_{res}) 是第二阶段的正式修复输出；不是把 (X_{rec}) 和 (X_{res}) 放在一起直接算一个损失，而是先训练双码本，再用冻结的码本训练修复路径。

## 为什么一定要离散码本

如果直接在连续隐空间中最大化 IQA 分数，网络可能学会制造能够欺骗 IQA 模型的纹理。视觉上看起来分数变高了，实际却出现了不存在的线条、重复纹理或结构扭曲。

离散码本相当于把输出限制在有限的特征集合中。Common codebook 提供结构约束，HQ+ codebook 提供经过高质量样本筛选的细节约束。这样，质量损失不再能无限制地把特征推向任意方向，过度优化产生幻觉的风险会降低。

当然，离散空间不是绝对安全的。码本本身仍然可能存在偏差，IQA 模型也可能偏爱某些纹理。它解决的是连续空间无限优化的问题，而不是彻底消除生成错误。

## 以前有没有人这么做过

码本用于图像恢复、IQA 用于评价、质量筛选高分样本，这些单独的元素都不是第一次出现。真正比较新的是三者的组合关系：

1. 用多个 NR-IQA 模型统计 GT 质量，而不是把 GT 当成同质数据；
2. 用质量阈值控制 HQ+ 码本更新，分离通用结构和高清细节；
3. 把质量分数同时作为 Transformer 条件和优化目标；
4. 在离散码本空间内进行质量优化，降低 IQA 对抗伪影。

所以它不是凭空发明了“码本”或“IQA 损失”，但把评价模型、数据筛选、离散表征和条件修复串成了一个闭环。这比单纯把 IQA 分数加进 loss 更完整，也更有说服力。

## 我的判断

我认为 IQPIR 是目前几篇工作中比较有想法的一篇。它没有继续盲目扩大恢复主干，而是先追问一个经常被忽略的问题：训练目标真的代表我们想要的画质吗？

它的优点是：问题动机真实，双码本逻辑清楚，质量先验既作为输入又作为目标，离散空间也确实缓解了连续 IQA 优化容易产生幻觉的问题。

但它也有明显前提：NR-IQA 分数必须足够可靠，阈值 (S_{Thr}) 和最高目标分数需要选择，HQ+ 码本可能继承筛选数据的偏见，而且“更高 IQA 分数”并不总等于更真实。对文字、人脸身份和精细结构，仍然需要 OCR、识别模型或人工评测辅助。

我的最终评价是：IQPIR 的核心创新不在某一个复杂模块，而在于把图像质量先验真正纳入了监督、表示和优化三个层面。它不是简单地“用 IQA 涨点”，而是试图回答为什么可以相信一个质量分数、如何利用高质量细节、以及如何限制质量优化产生幻觉。这也是它比普通感知损失更有意思的地方。

原论文：[Beyond Ground-Truth: Leveraging Image Quality Priors for Real-World Image Restoration](https://openaccess.thecvf.com/content/CVPR2026/html/Xiao_Beyond_Ground-Truth_Leveraging_Image_Quality_Priors_for_Real-World_Image_Restoration_CVPR_2026_paper.html)  
代码：[IQPIR GitHub](https://github.com/fengyang1399-pixel/IQPIR)
